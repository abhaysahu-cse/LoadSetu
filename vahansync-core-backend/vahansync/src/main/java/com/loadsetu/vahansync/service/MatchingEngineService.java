package com.loadsetu.vahansync.service;

import com.loadsetu.vahansync.dto.Dtos;
import com.loadsetu.vahansync.entity.Load;
import com.loadsetu.vahansync.repository.LoadRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class MatchingEngineService {

    private static final double EARTH_RADIUS_KM = 6371.0;
    private static final double BASE_SCORE = 100.0;
    private static final int MAX_MATCHES = 5;
    private static final Set<String> ELIGIBLE_STATUSES = Set.of("AVAILABLE", "EMPTY_RETURN");
    private static final Logger log = LoggerFactory.getLogger(MatchingEngineService.class);

    // Recency thresholds
    private static final long FRESH_SECONDS = 10;
    private static final long RECENT_SECONDS = 30;
    private static final long STALE_SECONDS = 60;
    private static final long DEAD_SECONDS = 120;

    private final LoadRepository loadRepository;

    public MatchingEngineService(LoadRepository loadRepository) {
        this.loadRepository = loadRepository;
    }

    public record TruckState(
            String truckId,
            Double lat,
            Double lng,
            String status,
            int noShowCount,
            Instant lastUpdated
    ) {}

    public List<Dtos.MatchCandidate> findBestMatches(
            double pickupLat,
            double pickupLng,
            List<TruckState> nearbyTrucks,
            UUID loadId
    ) {
        if (loadId == null || nearbyTrucks == null || nearbyTrucks.isEmpty()) {
            return List.of();
        }

        Load load = loadRepository.findById(loadId).orElse(null);
        if (load == null) {
            log.warn("Load not found for matching: {}", loadId);
            return List.of();
        }

        Map<String, TruckState> unique = new HashMap<>();
        for (TruckState truckState : nearbyTrucks) {
            if (truckState == null || truckState.truckId() == null || truckState.truckId().isBlank()) {
                continue;
            }
            unique.putIfAbsent(truckState.truckId(), truckState);
        }

        return unique.values().stream()
                .filter(this::isEligible)
                .map(truckState -> toMatchCandidate(load, pickupLat, pickupLng, truckState))
                .sorted((left, right) -> Double.compare(scoreOf(right), scoreOf(left)))
                .limit(MAX_MATCHES)
                .toList();
    }

    private boolean isEligible(TruckState truckState) {
        if (truckState.lat() == null || truckState.lng() == null) {
            return false;
        }
        if (truckState.noShowCount() >= 3) {
            return false;
        }
        if (!ELIGIBLE_STATUSES.contains(normalizeStatus(truckState.status()))) {
            return false;
        }
        // Stale data exclusion: no update in >2 min → truck is dead to us
        if (truckState.lastUpdated() != null) {
            long ageSeconds = Duration.between(truckState.lastUpdated(), Instant.now()).getSeconds();
            if (ageSeconds > DEAD_SECONDS) {
                log.debug("Excluding stale truck {} ({}s since last update)", truckState.truckId(), ageSeconds);
                return false;
            }
        }
        return true;
    }

    private Dtos.MatchCandidate toMatchCandidate(
            Load load,
            double pickupLat,
            double pickupLng,
            TruckState truckState
    ) {
        double distanceKm = haversineKm(pickupLat, pickupLng, truckState.lat(), truckState.lng());
        String normalizedStatus = normalizeStatus(truckState.status());

        double score = BASE_SCORE;

        // ── Distance penalty ──────────────────────────────────────────
        score -= (distanceKm * 2.5);

        // ── Reliability penalty (no-show history) ─────────────────────
        double reliabilityScore = Math.max(0, 100.0 - (truckState.noShowCount() * 10.0));
        score += reliabilityScore * 0.2;
        score -= (truckState.noShowCount() * 15.0);

        // ── Status bonus ──────────────────────────────────────────────
        if ("EMPTY_RETURN".equals(normalizedStatus)) {
            score += 75.0;
            // Empty-return proximity priority: <20km → strong boost over all others
            if (distanceKm < 20.0) {
                score += 50.0;
            }
        } else if ("AVAILABLE".equals(normalizedStatus)) {
            score += 20.0;
        }

        // ── Recency boost / penalty ──────────────────────────────────
        if (truckState.lastUpdated() != null) {
            long ageSeconds = Duration.between(truckState.lastUpdated(), Instant.now()).getSeconds();
            if (ageSeconds < FRESH_SECONDS) {
                score += 20.0;      // ultra-fresh — high confidence in position
            } else if (ageSeconds < RECENT_SECONDS) {
                score += 10.0;      // recent — still reliable
            } else if (ageSeconds > STALE_SECONDS) {
                score -= 20.0;      // getting stale — lower confidence
            }
        }

        return Dtos.MatchCandidate.builder()
                .truckId(truckState.truckId())
                .loadId(load.getId())
                .origin(load.getOriginName())
                .destination(load.getDestinationName())
                .payoutInr(load.getPayoutInr())
                .deadheadKm(distanceKm)
                .confidenceScore(Math.max(score, 0.0))
                .build();
    }

    private double haversineKm(double originLat, double originLng, double targetLat, double targetLng) {
        double latDistance = Math.toRadians(targetLat - originLat);
        double lngDistance = Math.toRadians(targetLng - originLng);
        double a = Math.sin(latDistance / 2.0) * Math.sin(latDistance / 2.0)
                + Math.cos(Math.toRadians(originLat))
                * Math.cos(Math.toRadians(targetLat))
                * Math.sin(lngDistance / 2.0)
                * Math.sin(lngDistance / 2.0);
        double c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
        return EARTH_RADIUS_KM * c;
    }

    private String normalizeStatus(String status) {
        return status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
    }

    private double scoreOf(Dtos.MatchCandidate candidate) {
        return candidate.getConfidenceScore() != null ? candidate.getConfidenceScore() : 0.0;
    }
}