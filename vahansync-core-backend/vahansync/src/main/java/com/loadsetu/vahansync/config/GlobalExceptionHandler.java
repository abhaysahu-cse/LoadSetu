package com.loadsetu.vahansync.config;

import com.loadsetu.vahansync.filter.CorrelationIdFilter;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

/**
 * MODULE 4: Global Exception Handler — V3.
 *
 * Rules:
 *  - NEVER return a stack trace in the response body
 *  - ALWAYS include requestId (from MDC, populated by CorrelationIdFilter)
 *  - Use consistent JSON envelope: {status, error, message, requestId, timestamp, path}
 *
 * Stack traces are only written to the application log (for ops team),
 * never exposed to the client.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /** 400 — Bean validation (@Valid annotation failures) */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorBody> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest req) {
        String details = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining("; "));
        return build(HttpStatus.BAD_REQUEST, "Validation Failed", details, req);
    }

    /** 404 — Entity not found */
    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ErrorBody> handleNotFound(
            NoSuchElementException ex, HttpServletRequest req) {
        return build(HttpStatus.NOT_FOUND, "Not Found", ex.getMessage(), req);
    }

    /** 4xx/5xx — Service-layer ResponseStatusException (IDOR, conflicts, etc.) */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorBody> handleStatus(
            ResponseStatusException ex, HttpServletRequest req) {
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        // Sanitize message — ResponseStatusException can contain internal details
        String safe = sanitize(ex.getReason() != null ? ex.getReason() : "Request error");
        return build(status, status.getReasonPhrase(), safe, req);
    }

    /** 409 — Concurrent conflict (e.g., double-booking attempt) */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorBody> handleConflict(
            IllegalStateException ex, HttpServletRequest req) {
        return build(HttpStatus.CONFLICT, "Conflict", sanitize(ex.getMessage()), req);
    }

    /** 503 — Circuit breaker open (ULIP / payment gateway down) */
    @ExceptionHandler(CallNotPermittedException.class)
    public ResponseEntity<ErrorBody> handleCircuitBreaker(
            CallNotPermittedException ex, HttpServletRequest req) {
        log.warn("Circuit breaker OPEN at {}: {}", req.getRequestURI(), ex.getMessage());
        return build(HttpStatus.SERVICE_UNAVAILABLE, "Service Temporarily Unavailable",
                "An external service is temporarily unavailable. Please retry in 30 seconds.",
                req);
    }

    /**
     * 500 — Catch-all.
     * Log full stack trace internally, return generic message to client.
     * MODULE 4 RULE: Never expose stack trace or internal exception message.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorBody> handleGeneric(Exception ex, HttpServletRequest req) {
        log.error("Unhandled exception [requestId={}] at {}: {}",
                MDC.get(CorrelationIdFilter.MDC_REQUEST_ID_KEY),
                req.getRequestURI(),
                ex.getMessage(),
                ex); // Stack trace in logs only — never in response
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error",
                "System busy. If this persists, quote your requestId to support.",
                req);
    }

    // ── Builder ───────────────────────────────────────────────────────────────

    private ResponseEntity<ErrorBody> build(
            HttpStatus status, String error, String message, HttpServletRequest req) {

        // Pull requestId from MDC (set by CorrelationIdFilter at thread start)
        String requestId = MDC.get(CorrelationIdFilter.MDC_REQUEST_ID_KEY);

        return ResponseEntity.status(status).body(
                new ErrorBody(
                        status.value(),
                        error,
                        message,
                        requestId,         // MODULE 4: always included
                        Instant.now(),
                        req.getRequestURI()
                )
        );
    }

    /** Remove newlines and limit length to prevent log injection via error messages. */
    private String sanitize(String msg) {
        if (msg == null) return "An error occurred";
        return msg.replaceAll("[\r\n]", " ").substring(0, Math.min(msg.length(), 300));
    }

    // ── Response envelope ─────────────────────────────────────────────────────

    public record ErrorBody(
            int status,
            String error,
            String message,
            String requestId,
            Instant timestamp,
            String path
    ) {}
}
