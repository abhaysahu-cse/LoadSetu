package com.loadsetu.vahansync.service;

import com.loadsetu.vahansync.entity.Truck;
import com.loadsetu.vahansync.repository.TruckRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.UUID;

/**
 * DISTRIBUTED BOOKING LOCK SERVICE — V3.
 *
 * V3 MODULE 8 CHANGE — REDIS FAIL-OPEN:
 * Previous V2 spec used fail-fast (503 if Redis down).
 * V3 spec mandates fail-OPEN: if Upstash Redis is unreachable due to
 * network jitter, LOG the error and ALLOW the request to proceed.
 * This prevents a cloud Redis blip from taking down the entire booking flow.
 *
 * Trade-off: During a Redis outage, double-bookings are possible.
 * The PostgreSQL markAsBooked() atomic update provides a last-resort
 * safety net — only one transaction will win the UPDATE.
 *
 * SHADOW BAN ENFORCEMENT (unchanged from V2):
 *   noShowCount >= 5 → hard block (403 FORBIDDEN)
 *   noShowCount >= 3 → deprioritized in Python AI ranker
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReservationService {

    private final StringRedisTemplate redisTemplate;
    private final TruckRepository     truckRepository;

    @Value("${loadsetu.matching.shadow-ban.hard-block-threshold:5}")
    private int hardBlockThreshold;

    @Value("${loadsetu.matching.shadow-ban.deprioritize-threshold:3}")
    private int deprioritizeThreshold;

    private static final Duration LOCK_TTL = Duration.ofMinutes(10);
    private static final String   LOCK_PREFIX = "load:lock:";

    /**
     * Attempt to acquire Redis lock for a truck-load booking.
     *
     * MODULE 8: All Redis calls wrapped in try-catch.
     * On exception → log + continue (fail-open). PostgreSQL atomic
     * update in LoadService.confirmBooking() is the safety backstop.
     */
    public void acquireLockOrThrow(UUID truckId, UUID loadId) {
        // Shadow ban check (PG read — always runs)
        Truck truck = truckRepository.findById(truckId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Truck not found: " + truckId));

        if (truck.getNoShowCount() >= hardBlockThreshold) {
            log.warn("SHADOW BAN HARD BLOCK: truck={} noShowCount={}",
                    truckId, truck.getNoShowCount());
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Account restricted due to repeated no-shows. Contact support@loadsetu.in");
        }

        // ─── MODULE 8: FAIL-OPEN Redis lock ──────────────────────────────────
        try {
            String lockKey   = LOCK_PREFIX + loadId.toString();
            Boolean acquired = redisTemplate.opsForValue()
                    .setIfAbsent(lockKey, truckId.toString(), LOCK_TTL);

            if (Boolean.FALSE.equals(acquired)) {
                String holder = redisTemplate.opsForValue().get(lockKey);
                log.info("Lock contention: load={} held by truck={}", loadId, holder);
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "This load was just claimed by another driver. Try the next match.");
            }

            log.info("Redis lock acquired: load={} truck={}", loadId, truckId);

        } catch (ResponseStatusException rse) {
            throw rse; // Re-throw conflict — this is business logic, not infra failure
        } catch (Exception ex) {
            // FAIL-OPEN: Redis unavailable — log and allow booking to proceed
            // PostgreSQL markAsBooked() atomic UPDATE is the backstop
            log.error("Redis unavailable for booking lock (fail-open): load={} error={}",
                    loadId, ex.getMessage());
        }
    }

    /** Release lock — fail-open, non-critical (TTL handles expiry). */
    public void releaseLock(UUID loadId) {
        try {
            redisTemplate.delete(LOCK_PREFIX + loadId.toString());
        } catch (Exception ex) {
            log.warn("Failed to release Redis lock for load={}: {}", loadId, ex.getMessage());
            // Non-critical — TTL will expire the lock regardless
        }
    }

    public boolean isDeprioritized(int noShowCount) {
        return noShowCount >= deprioritizeThreshold && noShowCount < hardBlockThreshold;
    }
}
