package com.loadsetu.vahansync.service;

import com.loadsetu.vahansync.entity.Truck;
import com.loadsetu.vahansync.repository.TruckRepository;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

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

    private final StringRedisTemplate redisTemplate;
    private final TruckRepository truckRepository;

    public RedisService(StringRedisTemplate redisTemplate, TruckRepository truckRepository) {
        this.redisTemplate = redisTemplate;
        this.truckRepository = truckRepository;
    }

    public List<MatchingEngineService.TruckState> findTruckStatesByH3Indexes(Collection<String> h3Indexes) {
        if (h3Indexes == null || h3Indexes.isEmpty()) {
            return List.of();
        }

        try {
            Set<String> redisKeys = redisTemplate.keys("truck:h3:*");
            if (redisKeys == null || redisKeys.isEmpty()) {
                return List.of();
            }

            List<String> matchingTruckIds = new ArrayList<>();
            for (String redisKey : redisKeys) {
                String cell = redisTemplate.opsForValue().get(redisKey);
                if (cell != null && h3Indexes.contains(cell)) {
                    matchingTruckIds.add(extractTruckId(redisKey));
                }
            }
            return hydrateTruckStates(matchingTruckIds);
        } catch (Exception ex) {
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
                return List.of();
            }

            List<MatchingEngineService.TruckState> truckStates = hydrateTruckStates(
                    redisKeys.stream().map(this::extractTruckId).toList());

            return truckStates.stream()
                    .filter(truckState -> truckState.lat() != null && truckState.lng() != null)
                    .filter(truckState -> haversineKm(pickupLat, pickupLng, truckState.lat(), truckState.lng()) <= radiusKm)
                    .toList();
        } catch (Exception ex) {
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

        List<MatchingEngineService.TruckState> truckStates = new ArrayList<>();
        for (String truckId : truckIds) {
            UUID truckUuid = parseUuid(truckId);
            if (truckUuid == null) {
                continue;
            }

            Map<Object, Object> locationData = redisTemplate.opsForHash().entries("truck:location:" + truckId);
            if (locationData == null || locationData.isEmpty()) {
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
            return null;
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