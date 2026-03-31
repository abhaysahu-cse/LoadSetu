package com.loadsetu.vahansync.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.lang.reflect.Method;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Groups nearby loads by H3 cell for dispatch efficiency.
 *
 * Redis key pattern:
 *   load:h3:{cell} → SET of loadId strings
 *   TTL: 30 min (matches truck telemetry TTL)
 *
 * Use case: when matching a truck, also surface nearby loads
 * that could be combined into multi-drop routes.
 */
@Service
public class LoadClusterService {

    private static final int H3_RESOLUTION = 7;
    private static final Duration CLUSTER_TTL = Duration.ofMinutes(30);
    private static final Logger log = LoggerFactory.getLogger(LoadClusterService.class);

    private final StringRedisTemplate redisTemplate;

    public LoadClusterService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * Index a load by its pickup location's H3 cell.
     * Called when a new load event is received.
     */
    public void indexLoad(UUID loadId, double pickupLat, double pickupLng) {
        String cell = latLngToCell(pickupLat, pickupLng);
        if (cell == null) {
            return;
        }
        String key = "load:h3:" + cell;
        try {
            redisTemplate.opsForSet().add(key, loadId.toString());
            redisTemplate.expire(key, CLUSTER_TTL);
            log.debug("Indexed load {} in cluster cell {}", loadId, cell);
        } catch (Exception ex) {
            log.warn("Failed to index load cluster: {}", ex.getMessage());
        }
    }

    /**
     * Remove a load from its cluster (e.g., when booked or cancelled).
     */
    public void removeLoad(UUID loadId, double pickupLat, double pickupLng) {
        String cell = latLngToCell(pickupLat, pickupLng);
        if (cell == null) return;
        try {
            redisTemplate.opsForSet().remove("load:h3:" + cell, loadId.toString());
        } catch (Exception ex) {
            log.warn("Failed to remove load from cluster: {}", ex.getMessage());
        }
    }

    /**
     * Find all load IDs clustered near a given pickup point.
     * Searches the H3 cell and its immediate neighbors (kRing 1).
     */
    public List<String> findNearbyLoadIds(double lat, double lng) {
        Set<String> cells = expandRing(lat, lng, 1);
        Set<String> loadIds = new LinkedHashSet<>();
        for (String cell : cells) {
            try {
                Set<String> members = redisTemplate.opsForSet().members("load:h3:" + cell);
                if (members != null) {
                    loadIds.addAll(members);
                }
            } catch (Exception ex) {
                log.warn("Failed to read load cluster for cell {}: {}", cell, ex.getMessage());
            }
        }
        return new ArrayList<>(loadIds);
    }

    // ── H3 helpers (reflection-based, same pattern as LoadMatchingConsumer) ──

    private String latLngToCell(double lat, double lng) {
        Object h3Core = createH3Core();
        if (h3Core == null) return null;
        try {
            return invokeLatLngToCell(h3Core, lat, lng, H3_RESOLUTION);
        } catch (Exception ex) {
            log.warn("H3 cell conversion failed: {}", ex.getMessage());
            return null;
        }
    }

    private Set<String> expandRing(double lat, double lng, int ringSize) {
        Object h3Core = createH3Core();
        if (h3Core == null) return Set.of();
        try {
            String base = invokeLatLngToCell(h3Core, lat, lng, H3_RESOLUTION);
            if (base == null) return Set.of();
            return invokeKRing(h3Core, base, ringSize);
        } catch (Exception ex) {
            log.warn("H3 ring expansion failed: {}", ex.getMessage());
            return Set.of();
        }
    }

    private Object createH3Core() {
        try {
            Class<?> cls = Class.forName("com.uber.h3core.H3Core");
            return cls.getMethod("newInstance").invoke(null);
        } catch (Exception ex) {
            return null;
        }
    }

    private String invokeLatLngToCell(Object h3Core, double lat, double lng, int res) throws Exception {
        for (String methodName : new String[]{"geoToH3Address", "latLngToCellAddress"}) {
            try {
                Method m = h3Core.getClass().getMethod(methodName, double.class, double.class, int.class);
                return String.valueOf(m.invoke(h3Core, lat, lng, res));
            } catch (NoSuchMethodException ignored) {}
        }
        Method m = h3Core.getClass().getMethod("latLngToCell", double.class, double.class, int.class);
        Object raw = m.invoke(h3Core, lat, lng, res);
        try {
            Method ts = h3Core.getClass().getMethod("h3ToString", long.class);
            return String.valueOf(ts.invoke(h3Core, ((Number) raw).longValue()));
        } catch (NoSuchMethodException ignored) {
            return String.valueOf(raw);
        }
    }

    @SuppressWarnings("unchecked")
    private Set<String> invokeKRing(Object h3Core, String base, int ringSize) throws Exception {
        for (String methodName : new String[]{"kRing", "gridDisk"}) {
            try {
                Method m = h3Core.getClass().getMethod(methodName, String.class, int.class);
                Object result = m.invoke(h3Core, base, ringSize);
                if (result instanceof Collection<?> c) {
                    Set<String> set = new LinkedHashSet<>();
                    for (Object v : c) if (v != null) set.add(String.valueOf(v));
                    return set;
                }
            } catch (NoSuchMethodException ignored) {}
        }
        return Set.of(base);
    }
}
