package com.loadsetu.vahansync.entity;

import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.Point;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Load entity — V3 hardened.
 *
 * V3 changes:
 *  - shipperId is MANDATORY (not nullable) — enforces IDOR boundary
 *  - load_hash column for deduplication (from V2)
 *  - JPA Auditing replaces @CreationTimestamp
 *
 * IDOR RULE: Every query that reads or modifies a Load MUST include
 * the shipperId from the authenticated JWT token. Never use findById()
 * alone. Always use findByIdAndShipperId().
 */
@Entity
@Table(
    name = "loads",
    indexes = {
        @Index(name = "idx_load_status",          columnList = "status"),
        @Index(name = "idx_load_pickup_time",     columnList = "pickup_time"),
        @Index(name = "idx_load_shipper",         columnList = "shipper_id"),
        @Index(name = "idx_load_hash_unique",     columnList = "load_hash", unique = true)
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Load {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    // ─── Origin ───────────────────────────────────────────────────────────────

    @Column(name = "origin_name", nullable = false, length = 200)
    private String originName;

    /** PostGIS geometry(Point, 4326). GIST index created in Flyway migration. */
    @Column(name = "origin_geom", nullable = false, columnDefinition = "geometry(Point,4326)")
    private Point originGeom;

    // ─── Destination ──────────────────────────────────────────────────────────

    @Column(name = "destination_name", nullable = false, length = 200)
    private String destinationName;

    @Column(name = "destination_geom", nullable = false, columnDefinition = "geometry(Point,4326)")
    private Point destinationGeom;

    // ─── Freight Details ──────────────────────────────────────────────────────

    @Column(name = "required_capacity", nullable = false)
    private Double requiredCapacity;

    @Column(name = "payout_inr", nullable = false, precision = 12, scale = 2)
    private BigDecimal payoutInr;

    @Column(name = "pickup_time", nullable = false)
    private Instant pickupTime;

    @Column(name = "posted_at")
    private Instant postedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private LoadStatus status = LoadStatus.AVAILABLE;

    /**
     * MODULE 2 — IDOR BOUNDARY FIELD.
     * NOT NULL enforced at DB level. Every read/write must verify this
     * against the authenticated principal's userId.
     */
    @Column(name = "shipper_id", nullable = false)
    private UUID shipperId;

    /** V2 deduplication hash: sha256(shipperId|origin|destination|date). */
    @Column(name = "load_hash", length = 64, unique = true)
    private String loadHash;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    public enum LoadStatus {
        AVAILABLE, MATCHED, BOOKED, IN_TRANSIT, DELIVERED, CANCELLED
    }
}
