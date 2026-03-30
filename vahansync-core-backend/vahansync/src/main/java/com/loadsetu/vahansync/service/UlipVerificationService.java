package com.loadsetu.vahansync.service;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Set;

/**
 * ULIP + VAHAN verification service — V2.
 *
 * V2 changes:
 *  - @CircuitBreaker(name = "ulipService") — opens after 50% failures
 *    over 10 calls. Prevents ULIP API latency from exhausting our threads.
 *  - @Retry(name = "ulipService") — retries up to 3x with exponential
 *    backoff for transient IOExceptions.
 *  - Fallback method: verifyTruckRcFallback() returns false when circuit
 *    is open — safe default (rejects unverified trucks during ULIP outage).
 */
@Service
@Slf4j
public class UlipVerificationService {

    @Value("${loadsetu.ulip.mock-enabled:true}")
    private boolean mockEnabled;

    @Value("${loadsetu.ulip.base-url:https://ulip.dpiit.gov.in/ulip}")
    private String ulipBaseUrl;

    private static final Set<String> BLACKLISTED_FOR_TESTING =
            Set.of("MH01INVALID", "TEST_FRAUD_123");

    /**
     * V2: Wrapped with Resilience4j Circuit Breaker + Retry.
     *
     * @CircuitBreaker opens the circuit after 50% failures (config in application.yml)
     * preventing cascading failures when ULIP API is down.
     *
     * @Retry retries transient failures (IOException, SocketTimeout) up to 3 times
     * before the CircuitBreaker counts the call as a failure.
     *
     * fallbackMethod is invoked when the circuit is open OR all retries exhausted.
     */
    @CircuitBreaker(name = "ulipService", fallbackMethod = "verifyTruckRcFallback")
    @Retry(name = "ulipService")
    public boolean verifyTruckRc(String truckNumber) {
        if (mockEnabled) {
            return mockVerification(truckNumber);
        }
        return liveUlipVerification(truckNumber);
    }

    /**
     * Circuit Breaker fallback — invoked when ULIP is unreachable.
     * Returns false (conservative) to prevent unverified trucks entering
     * the platform during an outage.
     *
     * TODO: In V3, implement a local RC cache (Redis TTL 24h) so recent
     * verifications can serve from cache during ULIP downtime.
     */
    public boolean verifyTruckRcFallback(String truckNumber, Throwable ex) {
        log.error("ULIP CIRCUIT OPEN — fallback for truckNumber={}: {}",
                truckNumber, ex.getMessage());
        return false;
    }

    private boolean mockVerification(String truckNumber) {
        log.info("[MOCK-ULIP] Verifying RC: {}", truckNumber);
        try { Thread.sleep(200); } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        if (BLACKLISTED_FOR_TESTING.contains(truckNumber.toUpperCase())) return false;
        return truckNumber != null && truckNumber.length() >= 8
                && truckNumber.matches("[A-Z]{2}[0-9]{2}[A-Z]{1,3}[0-9]{4}");
    }

    private boolean liveUlipVerification(String truckNumber) {
        // TODO: Implement with RestClient + ULIP API key
        throw new UnsupportedOperationException(
                "Live ULIP verification not yet implemented.");
    }
}
