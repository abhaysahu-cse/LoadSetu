package com.loadsetu.vahansync.repository;

import com.loadsetu.vahansync.entity.Load;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Load repository — V3 hardened.
 *
 * V3 IDOR RULE: Never use findById() alone from controllers or services.
 * Always use findByIdAndShipperId() to enforce ownership boundary.
 * The shipperId MUST come from the authenticated JWT principal, never
 * from the request body (untrusted).
 */
@Repository
public interface LoadRepository extends JpaRepository<Load, UUID> {

    // ─── MODULE 2: IDOR-SAFE READ ────────────────────────────────────────────

    /**
     * IDOR-safe load fetch. shipperId must match the authenticated user.
     * Returns empty if the load exists but belongs to a different shipper —
     * caller should return 404 (not 403, to avoid confirming load existence).
     */
    Optional<Load> findByIdAndShipperId(UUID id, UUID shipperId);

    List<Load> findByShipperIdOrderByCreatedAtDesc(UUID shipperId);

    // ─── PRIMARY SPATIAL QUERY ───────────────────────────────────────────────

    /**
     * ST_DWithin + ST_Distance native PostGIS query.
     * Called by Python AI service via POST /api/v1/loads/match.
     *
     * CRITICAL INDEX:
     *   CREATE INDEX idx_load_origin_geom ON loads USING GIST(origin_geom);
     */
    @Query(value = """
            SELECT
                l.id, l.origin_name, l.origin_geom, l.destination_name,
                l.destination_geom, l.required_capacity, l.payout_inr,
                l.pickup_time, l.posted_at, l.status, l.shipper_id, l.created_at,
                ST_Distance(
                    l.origin_geom::geography,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                ) / 1000.0 AS deadhead_km
            FROM loads l
            WHERE
                ST_DWithin(
                    l.origin_geom::geography,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                    :radiusMeters
                )
                AND l.required_capacity <= :capacityTons
                AND l.status = 'AVAILABLE'
            ORDER BY deadhead_km ASC
            LIMIT 20
            """, nativeQuery = true)
    List<Object[]> findLoadsWithDeadheadKm(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("capacityTons") double capacityTons,
            @Param("radiusMeters") double radiusMeters
    );

    // ─── BOOKING LOCK ────────────────────────────────────────────────────────

    @Modifying
    @Transactional
    @Query(value = "UPDATE loads SET status = 'BOOKED' WHERE id = :loadId AND status = 'AVAILABLE'",
           nativeQuery = true)
    int markAsBooked(@Param("loadId") UUID loadId);

    // ─── V2: DEDUPLICATION ───────────────────────────────────────────────────

    @Query(value = "SELECT EXISTS(SELECT 1 FROM loads WHERE load_hash = :hash)",
           nativeQuery = true)
    boolean existsByLoadHash(@Param("hash") String hash);

    /**
     * INSERT ... ON CONFLICT (load_hash) DO NOTHING.
     * Silently skips duplicate loads — never crashes a bulk batch.
     */
    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO loads
                (id, origin_name, origin_geom, destination_name, destination_geom,
                 required_capacity, payout_inr, pickup_time, status, shipper_id,
                 load_hash, created_at)
            VALUES
                (uuid_generate_v4(),
                 :originName,
                 ST_SetSRID(ST_MakePoint(:originLng, :originLat), 4326),
                 :destinationName,
                 ST_SetSRID(ST_MakePoint(:destinationLng, :destinationLat), 4326),
                 :requiredCapacity, :payoutInr, :pickupTime,
                 'AVAILABLE', :shipperId, :loadHash, NOW())
            ON CONFLICT (load_hash) DO NOTHING
            """, nativeQuery = true)
    int insertWithHash(
            @Param("originName") String originName,
            @Param("originLat") double originLat,
            @Param("originLng") double originLng,
            @Param("destinationName") String destinationName,
            @Param("destinationLat") double destinationLat,
            @Param("destinationLng") double destinationLng,
            @Param("requiredCapacity") double requiredCapacity,
            @Param("payoutInr") BigDecimal payoutInr,
            @Param("pickupTime") Instant pickupTime,
            @Param("shipperId") UUID shipperId,
            @Param("loadHash") String loadHash
    );
}
