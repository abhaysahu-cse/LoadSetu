package com.loadsetu.vahansync.service;

import com.loadsetu.vahansync.entity.Truck;
import com.loadsetu.vahansync.repository.TruckRepository;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class RedisService {

    private static final double EARTH_RADIUS_KM = 6371.0;
    private static final Logger log = LoggerFactory.getLogger(RedisService.class);

    private final StringRedisTemplate redisTemplate;
    private final TruckRepository truckRepository;

    public RedisService(StringRedisTemplate redisTemplate, TruckRepository truckRepository) {
        this.redisTemplate = redisTemplate;
        this.truckRepository = truckRepository;
    }

    public List<MatchingEngineService.TruckState> findTruckStatesByH3Indexes(Collection<String> h3Indexes) {
        if (h3Indexes == null || h3Indexes.isEmpty()) {
            log.debug("H3 index lookup skipped: h3Indexes is null/empty");
            return List.of();
        }

        try {
            log.debug("H3 lookup: searching for cells in ring: {}", h3Indexes);
            Set<String> redisKeys = redisTemplate.keys("truck:h3:*");
            if (redisKeys == null || redisKeys.isEmpty()) {
                log.warn("H3 lookup: no truck:h3:* keys found in Redis");
                return List.of();
            }
            log.debug("H3 lookup: found {} truck:h3:* keys in Redis", redisKeys.size());

            List<String> matchingTruckIds = new ArrayList<>();
            int sampledCells = 0;
            String sampleCell = null;
            for (String redisKey : redisKeys) {
                String cell = redisTemplate.opsForValue().get(redisKey);
                if (sampledCells < 3 && cell != null) {
                    log.debug("H3 lookup sample: key={} cell={}", redisKey, cell);
                    sampleCell = cell;
                    sampledCells++;
                }
                if (cell != null && h3Indexes.contains(cell)) {
                    matchingTruckIds.add(extractTruckId(redisKey));
                }
            }
            log.info("H3 lookup: {} trucks matched out of {} scanned | wanted_cells={} sample_redis_cell={}",
                    matchingTruckIds.size(), redisKeys.size(), h3Indexes, sampleCell);
            if (!matchingTruckIds.isEmpty()) {
                log.info("H3 matched truck IDs (first 10): {}",
                        matchingTruckIds.subList(0, Math.min(10, matchingTruckIds.size())));
            }
            return hydrateTruckStates(matchingTruckIds);
        } catch (Exception ex) {
            log.error("H3 lookup failed: {}", ex.getMessage(), ex);
            return List.of();
        }
    }

    public List<MatchingEngineService.TruckState> findTruckStatesWithinRadius(
            double pickupLat,
            double pickupLng,
            double radiusKm
    ) {
        try {
            Set<String> redisKeys = redisTemplate.keys("truck:location:*");
            if (redisKeys == null || redisKeys.isEmpty()) {
                log.warn("Radius lookup: no truck:location:* keys found in Redis");
                return List.of();
            }
            log.debug("Radius lookup: found {} truck:location:* keys", redisKeys.size());

            List<MatchingEngineService.TruckState> truckStates = hydrateTruckStates(
                    redisKeys.stream().map(this::extractTruckId).toList());
            log.debug("Radius lookup: hydrated {} truck states", truckStates.size());

            List<MatchingEngineService.TruckState> filtered = truckStates.stream()
                    .filter(truckState -> truckState.lat() != null && truckState.lng() != null)
                    .filter(truckState -> haversineKm(pickupLat, pickupLng, truckState.lat(), truckState.lng()) <= radiusKm)
                    .toList();
            log.info("Radius lookup: {} trucks within {}km of ({}, {})", filtered.size(), radiusKm, pickupLat, pickupLng);
            return filtered;
        } catch (Exception ex) {
            log.error("Radius lookup failed: {}", ex.getMessage(), ex);
            return List.of();
        }
    }

    private List<MatchingEngineService.TruckState> hydrateTruckStates(Collection<String> truckIds) {
        if (truckIds == null || truckIds.isEmpty()) {
            return List.of();
        }

        Map<UUID, Truck> trucksById = new HashMap<>();
        List<UUID> validTruckIds = truckIds.stream()
                .map(this::parseUuid)
                .filter(uuid -> uuid != null)
                .distinct()
                .toList();
        for (Truck truck : truckRepository.findAllById(validTruckIds)) {
            trucksById.put(truck.getId(), truck);
        }

        int skippedNoUuid = 0;
        int skippedNoLocation = 0;
        List<MatchingEngineService.TruckState> truckStates = new ArrayList<>();
        for (String truckId : truckIds) {
            UUID truckUuid = parseUuid(truckId);
            if (truckUuid == null) {
                skippedNoUuid++;
                continue;
            }

            Map<Object, Object> locationData = redisTemplate.opsForHash().entries("truck:location:" + truckId);
            if (locationData == null || locationData.isEmpty()) {
                skippedNoLocation++;
                continue;
            }

            Truck truck = trucksById.get(truckUuid);
            int noShowCount = truck != null && truck.getNoShowCount() != null ? truck.getNoShowCount() : 0;
            String status = stringValue(locationData.get("status"));
            if (status.isBlank() && truck != null && truck.getStatus() != null) {
                status = truck.getStatus().name().toLowerCase(Locale.ROOT);
            }

            Instant lastUpdated = parseInstant(locationData.get("last_updated"));

            truckStates.add(new MatchingEngineService.TruckState(
                    truckId,
                    parseDouble(locationData.get("lat")),
                    parseDouble(locationData.get("lng")),
                    status,
                    noShowCount,
                    lastUpdated
            ));
        }
        log.info("hydrateTruckStates: input={} hydrated={} skippedNoUuid={} skippedNoLocation={} foundInPostgres={}",
                truckIds.size(), truckStates.size(), skippedNoUuid, skippedNoLocation, trucksById.size());
        return truckStates;
    }

    private String extractTruckId(String redisKey) {
        return redisKey.substring(redisKey.lastIndexOf(':') + 1);
    }

    private UUID parseUuid(String value) {
        try {
            return value == null || value.isBlank() ? null : UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private Double parseDouble(Object value) {
        try {
            return value == null ? null : Double.valueOf(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private Instant parseInstant(Object value) {
        if (value == null) return null;
        try {
            return Instant.parse(String.valueOf(value));
        } catch (Exception ex) {
            try {
                return java.time.OffsetDateTime.parse(String.valueOf(value)).toInstant();
            } catch (Exception ex2) {
                return null;
            }
        }
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
}