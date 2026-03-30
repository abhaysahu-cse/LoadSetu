package com.loadsetu.vahansync.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.codec.ByteArrayCodec;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.time.Duration;
import java.util.function.Supplier;

/**
 * BUCKET4J + UPSTASH REDIS RATE LIMITER — V3.
 *
 * Uses Upstash Cloud Redis (SSL: rediss://) so limits are enforced
 * across all EKS pods simultaneously.
 *
 * MODULE 8 — FAIL-OPEN:
 * ALL Redis calls wrapped in try-catch. If Upstash is unreachable,
 * log the error and ALLOW the request through. Never let a Redis
 * outage take down the matching API.
 *
 * Limits:
 *   AI Matching  (/loads/match):  5 requests / 10 seconds per IP
 *   Public API   (default):      20 requests / 60 seconds per IP
 */
@Configuration
@Slf4j
public class RateLimitConfig implements WebMvcConfigurer {

    @Value("${spring.data.redis.host:localhost}")
    private String redisHost;

    @Value("${spring.data.redis.port:6379}")
    private int redisPort;

    @Value("${spring.data.redis.password:}")
    private String redisPassword;

    @Value("${spring.data.redis.ssl.enabled:false}")
    private boolean redisSsl;

    @Value("${rate-limit.loads-match.capacity:5}")
    private int loadsMatchCapacity;

    @Value("${rate-limit.loads-match.refill-seconds:10}")
    private int loadsMatchRefillSeconds;

    @Value("${rate-limit.public-api.capacity:20}")
    private int publicApiCapacity;

    @Value("${rate-limit.public-api.refill-seconds:60}")
    private int publicApiRefillSeconds;

    @Bean
    public ProxyManager<byte[]> bucketProxyManager() {
        RedisURI.Builder uriBuilder = RedisURI.builder()
                .withHost(redisHost)
                .withPort(redisPort)
                .withSsl(redisSsl); // true for Upstash (rediss://)

        if (redisPassword != null && !redisPassword.isBlank()) {
            uriBuilder.withPassword(redisPassword.toCharArray());
        }

        RedisClient client = RedisClient.create(uriBuilder.build());
        StatefulRedisConnection<byte[], byte[]> conn = client.connect(ByteArrayCodec.INSTANCE);
        return LettuceBasedProxyManager.builderFor(conn).build();
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Tight limit for AI matching endpoint
        registry.addInterceptor(
            buildInterceptor("loads-match", loadsMatchCapacity, loadsMatchRefillSeconds)
        ).addPathPatterns("/api/v1/loads/match");

        // Broad limit for general public endpoints
        registry.addInterceptor(
            buildInterceptor("public-api", publicApiCapacity, publicApiRefillSeconds)
        ).addPathPatterns("/api/v1/auth/**", "/api/v1/telemetry/**");
    }

    /**
     * Builds a rate-limit interceptor.
     * MODULE 8: Entire Redis interaction wrapped in try-catch.
     * If Upstash is down, request is ALLOWED (fail-open).
     */
    private HandlerInterceptor buildInterceptor(String key, int capacity, int refillSeconds) {
        ProxyManager<byte[]> proxy = bucketProxyManager();

        Supplier<BucketConfiguration> configSupplier = () ->
                BucketConfiguration.builder()
                        .addLimit(Bandwidth.builder()
                                .capacity(capacity)
                                .refillGreedy(capacity, Duration.ofSeconds(refillSeconds))
                                .build())
                        .build();

        return new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request,
                                     HttpServletResponse response,
                                     Object handler) throws Exception {
                String clientIp = extractIp(request);
                String bucketKey = "rl:" + key + ":" + clientIp;

                try {
                    Bucket bucket = proxy.builder()
                            .build(bucketKey.getBytes(), configSupplier);

                    if (bucket.tryConsume(1)) {
                        return true;
                    }

                    // Rate limit exceeded
                    log.warn("RATE LIMIT EXCEEDED: key={} ip={}", key, clientIp);
                    response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                    response.setContentType("application/json");
                    response.getWriter().write(
                            "{\"status\":429,\"error\":\"Too Many Requests\"," +
                            "\"message\":\"Rate limit exceeded. Max " + capacity +
                            " requests per " + refillSeconds + " seconds.\"}");
                    return false;

                } catch (Exception ex) {
                    // MODULE 8: FAIL-OPEN — Redis down, allow the request
                    log.error("Rate limiter Redis unavailable (fail-open): key={} ip={} error={}",
                            key, clientIp, ex.getMessage());
                    return true;
                }
            }

            private String extractIp(HttpServletRequest req) {
                String xff = req.getHeader("X-Forwarded-For");
                return (xff != null) ? xff.split(",")[0].trim() : req.getRemoteAddr();
            }
        };
    }
}
