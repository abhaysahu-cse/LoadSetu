package com.loadsetu.vahansync.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * MODULE 4: DISTRIBUTED TRACING — Correlation ID Filter.
 *
 * Must run FIRST in the filter chain (Order = 1) before any security
 * filter, so that every log line — including auth failures — carries
 * the requestId.
 *
 * Behaviour:
 *  1. If X-Request-ID header is present (from Python AI service), use it.
 *  2. If absent (browser/mobile client), generate a new UUID.
 *  3. Store in SLF4J MDC as "requestId" — logback-spring.xml includes it.
 *  4. Echo the requestId back in the response header so clients can correlate.
 *  5. ALWAYS clear MDC after request completes (thread pool reuse safety).
 *
 * This guarantees: a request traced from Python AI logs → Java logs
 * will carry the same Request ID end-to-end.
 */
@Component
@Order(1)
public class CorrelationIdFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_HEADER  = "X-Request-ID";
    public static final String MDC_REQUEST_ID_KEY = "requestId";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String requestId = request.getHeader(REQUEST_ID_HEADER);

        // Generate if not provided (inbound from browser/mobile)
        if (requestId == null || requestId.isBlank()) {
            requestId = UUID.randomUUID().toString();
        }

        // Push into MDC — picked up by every log statement in this thread
        MDC.put(MDC_REQUEST_ID_KEY, requestId);

        // Echo back so client can correlate response to request
        response.setHeader(REQUEST_ID_HEADER, requestId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            // CRITICAL: always clear MDC to prevent thread pool leakage
            MDC.remove(MDC_REQUEST_ID_KEY);
        }
    }
}
