package com.loadsetu.vahansync.security;

import com.loadsetu.vahansync.filter.CorrelationIdFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

// ═══════════════════════════════════════════════════════════════════════════════
//  MODULE 3 — INTERNAL AI SECURITY FILTER
//
//  Validates X-INTERNAL-SECRET header sent by the Python FastAPI service.
//  If valid → grants ROLE_INTERNAL_AI and short-circuits JWT processing.
//  If header present but WRONG → rejects with 401 immediately (no fallthrough).
//  If header absent → continues chain normally (JWT filter handles human users).
// ═══════════════════════════════════════════════════════════════════════════════

@Component
@Slf4j
@RequiredArgsConstructor
class InternalApiSecurityFilter extends OncePerRequestFilter {

    @Value("${loadsetu.internal.api-secret}")
    private String internalApiSecret;

    public static final String INTERNAL_SECRET_HEADER = "X-INTERNAL-SECRET";
    public static final String ROLE_INTERNAL_AI       = "ROLE_INTERNAL_AI";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String incoming = request.getHeader(INTERNAL_SECRET_HEADER);

        if (incoming != null && !incoming.isBlank()) {
            if (internalApiSecret.equals(incoming)) {
                // ✅ Valid — grant internal role, bypass JWT
                var auth = new UsernamePasswordAuthenticationToken(
                        "ai-service", null,
                        List.of(new SimpleGrantedAuthority(ROLE_INTERNAL_AI))
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
                log.debug("InternalApiSecurityFilter: ROLE_INTERNAL_AI granted [requestId={}]",
                        org.slf4j.MDC.get(CorrelationIdFilter.MDC_REQUEST_ID_KEY));
            } else {
                // ❌ Wrong secret — hard reject, do not fall through
                log.warn("InternalApiSecurityFilter: invalid X-INTERNAL-SECRET from ip={}",
                        request.getRemoteAddr());
                response.setStatus(HttpStatus.UNAUTHORIZED.value());
                response.setContentType("application/json");
                response.getWriter().write(
                        "{\"status\":401,\"error\":\"Unauthorized\"," +
                        "\"message\":\"Invalid internal API secret.\"," +
                        "\"requestId\":\"" +
                        org.slf4j.MDC.get(CorrelationIdFilter.MDC_REQUEST_ID_KEY) + "\"}");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  JWT AUTH FILTER — For React/Mobile human clients
//  Skips processing if InternalApiSecurityFilter already authenticated the request.
// ═══════════════════════════════════════════════════════════════════════════════

@Component
@RequiredArgsConstructor
@Slf4j
class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtils jwtUtils;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        // Short-circuit: already authenticated by InternalApiSecurityFilter
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            var claims = jwtUtils.validateToken(authHeader.substring(7));
            if (claims != null) {
                String role = claims.get("role", String.class);
                var auth = new UsernamePasswordAuthenticationToken(
                        claims.getSubject(), // userId string
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + (role != null ? role : "USER")))
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }

        filterChain.doFilter(request, response);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SECURITY CONFIG — 3-TIER FILTER CHAIN
//
//  TIER 1 — PUBLIC:    /auth/**, /telemetry/twilio, /health, /actuator/health
//  TIER 2 — INTERNAL:  /loads/match, /loads/bulk  → ROLE_INTERNAL_AI only
//  TIER 3 — JWT:       All other endpoints         → valid JWT required
//
//  Filter order (critical):
//    1. CorrelationIdFilter     (@Order(1) — populates MDC for ALL log lines)
//    2. InternalApiSecurityFilter (grants AI role or hard-rejects bad secrets)
//    3. JwtAuthFilter            (validates human JWT)
// ═══════════════════════════════════════════════════════════════════════════════

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter             jwtAuthFilter;
    private final InternalApiSecurityFilter internalApiSecurityFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            .authorizeHttpRequests(auth -> auth

                // ── TIER 1: PUBLIC ────────────────────────────────────────────
                .requestMatchers(
                    "/api/v1/auth/**",
                    "/api/v1/telemetry/twilio",
                    "/api/v1/health",
                    "/actuator/health",
                    "/actuator/info"
                ).permitAll()

                // ── TIER 2: INTERNAL AI MICROSERVICE ONLY ─────────────────────
                // Python FastAPI must send X-INTERNAL-SECRET header.
                // Browser/mobile clients hitting these without the secret
                // will receive 401 from InternalApiSecurityFilter.
                .requestMatchers(
                    "/api/v1/loads/match",
                    "/api/v1/loads/bulk"
                ).hasAuthority("ROLE_INTERNAL_AI")

                // ── TIER 3: AUTHENTICATED HUMAN USERS ─────────────────────────
                .anyRequest().authenticated()
            )

            // InternalApiSecurityFilter runs BEFORE JwtAuthFilter
            .addFilterBefore(internalApiSecurityFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(jwtAuthFilter, InternalApiSecurityFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}

