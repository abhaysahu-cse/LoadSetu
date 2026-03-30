package com.loadsetu.vahansync.consumer;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.loadsetu.vahansync.dto.Dtos;
import com.loadsetu.vahansync.service.MatchingEngineService;
import com.loadsetu.vahansync.service.RedisService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Component
public class LoadMatchingConsumer {

    private static final int H3_RESOLUTION = 7;
    private static final int H3_RING_SIZE = 2;
    private static final Logger log = LoggerFactory.getLogger(LoadMatchingConsumer.class);

    private final ObjectMapper objectMapper;
    private final MatchingEngineService matchingEngineService;
    private final RedisService redisService;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${loadsetu.matching.radius-km:50}")
    private double matchingRadiusKm;

    public LoadMatchingConsumer(
            ObjectMapper objectMapper,
            MatchingEngineService matchingEngineService,
            RedisService redisService,
            KafkaTemplate<String, Object> kafkaTemplate
    ) {
        this.objectMapper = objectMapper;
        this.matchingEngineService = matchingEngineService;
        this.redisService = redisService;
        this.kafkaTemplate = kafkaTemplate;
    }

    @KafkaListener(
        topics = "load-events",
        groupId = "vahansync-matching-group",
        autoStartup = "true",
        containerFactory = "stringKafkaListenerContainerFactory"
    )
    public void consumeLoadEvent(String payload) {
        LoadEvent event = parseEvent(payload);
        if (event == null || event.loadId() == null || event.pickupLat() == null || event.pickupLng() == null) {
            log.warn("Load matching event dropped: {}", payload);
            return;
        }

        try {
            List<String> h3Indexes = expandH3Ring(event.pickupLat(), event.pickupLng());
            List<MatchingEngineService.TruckState> nearbyTrucks = loadTruckStates(
                event.pickupLat(),
                event.pickupLng(),
                h3Indexes);
            List<Dtos.MatchCandidate> matches = matchingEngineService.findBestMatches(
                    event.pickupLat(),
                    event.pickupLng(),
                    nearbyTrucks,
                    event.loadId());
            publishMatches(event.loadId(), matches);
        } catch (Exception ex) {
            log.error("Load matching failed for load={}: {}", event.loadId(), ex.getMessage(), ex);
        }
    }

    private LoadEvent parseEvent(String payload) {
        try {
            return objectMapper.readValue(payload, LoadEvent.class);
        } catch (Exception ex) {
            log.warn("Failed to parse load event JSON: {}", ex.getMessage());
            return null;
        }
    }

    private List<MatchingEngineService.TruckState> loadTruckStates(
            double pickupLat,
            double pickupLng,
            Collection<String> h3Indexes
    ) {
        try {
            List<MatchingEngineService.TruckState> truckStates = h3Indexes == null || h3Indexes.isEmpty()
                    ? List.of()
                    : redisService.findTruckStatesByH3Indexes(h3Indexes);

            if (truckStates == null || truckStates.isEmpty()) {
                return redisService.findTruckStatesWithinRadius(pickupLat, pickupLng, matchingRadiusKm);
            }

            Map<String, MatchingEngineService.TruckState> uniqueTrucks = new LinkedHashMap<>();
            for (MatchingEngineService.TruckState truckState : truckStates) {
                if (truckState == null || truckState.truckId() == null || truckState.truckId().isBlank()) {
                    continue;
                }
                uniqueTrucks.putIfAbsent(truckState.truckId(), truckState);
            }
            return new ArrayList<>(uniqueTrucks.values());
        } catch (Exception ex) {
            log.warn("Redis truck lookup failed: {}", ex.getMessage());
            return List.of();
        }
    }

    private List<String> expandH3Ring(double lat, double lng) {
        Object h3Core = createH3Core();
        if (h3Core == null) {
            log.info("Falling back to radius-based Redis lookup because H3 is unavailable");
            return List.of();
        }

        try {
            String baseHex = invokeGeoToH3Address(h3Core, lat, lng, H3_RESOLUTION);
            if (baseHex == null || baseHex.isBlank()) {
                return List.of();
            }

            Set<String> expanded = invokeKRing(h3Core, baseHex, H3_RING_SIZE);
            if (expanded.isEmpty()) {
                return List.of(baseHex);
            }
            return new ArrayList<>(expanded);
        } catch (Exception ex) {
            log.warn("H3 expansion failed: {}", ex.getMessage());
            return List.of();
        }
    }

    private Object createH3Core() {
        try {
            Class<?> h3CoreClass = Class.forName("com.uber.h3core.H3Core");
            Method factoryMethod = h3CoreClass.getMethod("newInstance");
            return factoryMethod.invoke(null);
        } catch (ClassNotFoundException ex) {
            log.warn("H3 library not present on classpath; load matching will publish empty results");
            return null;
        } catch (Exception ex) {
            log.warn("Unable to initialise H3 core: {}", ex.getMessage());
            return null;
        }
    }

    private String invokeGeoToH3Address(Object h3Core, double lat, double lng, int resolution) throws Exception {
        try {
            Method method = h3Core.getClass().getMethod("geoToH3Address", double.class, double.class, int.class);
            return String.valueOf(method.invoke(h3Core, lat, lng, resolution));
        } catch (NoSuchMethodException ignored) {
        }

        try {
            Method method = h3Core.getClass().getMethod("latLngToCellAddress", double.class, double.class, int.class);
            return String.valueOf(method.invoke(h3Core, lat, lng, resolution));
        } catch (NoSuchMethodException ignored) {
        }

        Method method = h3Core.getClass().getMethod("latLngToCell", double.class, double.class, int.class);
        Object rawCell = method.invoke(h3Core, lat, lng, resolution);
        try {
            Method toStringMethod = h3Core.getClass().getMethod("h3ToString", long.class);
            return String.valueOf(toStringMethod.invoke(h3Core, ((Number) rawCell).longValue()));
        } catch (NoSuchMethodException ignored) {
            return String.valueOf(rawCell);
        }
    }

    @SuppressWarnings("unchecked")
    private Set<String> invokeKRing(Object h3Core, String baseHex, int ringSize) throws Exception {
        try {
            Method method = h3Core.getClass().getMethod("kRing", String.class, int.class);
            Object result = method.invoke(h3Core, baseHex, ringSize);
            if (result instanceof Collection<?> collection) {
                return toStringSet(collection);
            }
        } catch (NoSuchMethodException ignored) {
        }

        Method method = h3Core.getClass().getMethod("gridDisk", String.class, int.class);
        Object result = method.invoke(h3Core, baseHex, ringSize);
        if (result instanceof Collection<?> collection) {
            return toStringSet(collection);
        }
        return Set.of(baseHex);
    }

    private Set<String> toStringSet(Collection<?> values) {
        Set<String> normalized = new LinkedHashSet<>();
        for (Object value : values) {
            if (value != null) {
                normalized.add(String.valueOf(value));
            }
        }
        return normalized;
    }

    private void publishMatches(UUID loadId, List<Dtos.MatchCandidate> matches) {
        try {
            String json = objectMapper.writeValueAsString(new LoadMatchesPayload(
                    loadId.toString(),
                    matches,
                    Instant.now()));

            kafkaTemplate.send("load-matches", loadId.toString(), json)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.error("Kafka publish failed [load-matches] key={}: {}", loadId, ex.getMessage());
                        } else {
                            log.info("Kafka published [load-matches] key={} count={}", loadId, matches.size());
                        }
                    });
        } catch (Exception ex) {
            log.error("Failed to serialize load matches for load={}: {}", loadId, ex.getMessage(), ex);
        }
    }

    private record LoadEvent(
            @JsonProperty("loadId") UUID loadId,
            @JsonProperty("pickupLat") Double pickupLat,
            @JsonProperty("pickupLng") Double pickupLng
    ) {}

    private record LoadMatchesPayload(
            @JsonProperty("loadId") String loadId,
            @JsonProperty("matches") List<Dtos.MatchCandidate> matches,
            @JsonProperty("processedAt") Instant processedAt
    ) {}
}