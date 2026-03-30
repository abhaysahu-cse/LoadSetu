package com.loadsetu.vahansync.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Pattern;
import lombok.*;
import org.locationtech.jts.geom.Point;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Truck entity — V3 hardened.
 *
 * V3 changes:
 *  - truckNumber: Indian RTO regex validation (all state/UT formats)
 *  - ownerId: FK to User — enables IDOR-safe ownership checks
 *  - JPA Auditing replaces @CreationTimestamp/@UpdateTimestamp
 *  - noShowCount retained from V2 for shadow-ban enforcement
 */
@Entity
@Table(
    name = "trucks",
    indexes = {
        @Index(name = "idx_truck_phone",         columnList = "phone",        unique = true),
        @Index(name = "idx_truck_number",        columnList = "truck_number", unique = true),
        @Index(name = "idx_truck_status",        columnList = "status"),
        @Index(name = "idx_truck_owner",         columnList = "owner_id"),
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Truck {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "driver_name", nullable = false, length = 150)
    private String driverName;

    @Column(name = "phone", nullable = false, unique = true, length = 20)
    private String phone;

    @Column(name = "capacity_tons", nullable = false)
    private Double capacityTons;

    /**
     * MODULE 2: Indian RTO vehicle registration number.
     * Regex covers all state/UT formats:
     *   GJ05BV1234 | MH12AB1234 | DL01CAA1234
     * Pattern: 2-letter state code + 2-digit RTO + 1-3 letter series + 4 digits
     */
    @Pattern(
        regexp = "^[A-Z]{2}[0-9]{2}[A-Z]{1,3}[0-9]{4}$",
        message = "Invalid Indian vehicle registration number. Expected format: GJ05BV1234"
    )
    @Column(name = "truck_number", nullable = false, unique = true, length = 20)
    private String truckNumber;

    /**
     * PostGIS Point (SRID 4326 — WGS84).
     * Updated via Kafka telemetry consumer on every GPS ping.
     */
    @Column(name = "current_location", columnDefinition = "geometry(Point,4326)")
    private Point currentLocation;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private TruckStatus status = TruckStatus.AVAILABLE;

    /** FK to User.id — the fleet owner or driver who registered this truck. */
    @Column(name = "owner_id")
    private UUID ownerId;

    /** V2 shadow-ban counter. */
    @Column(name = "no_show_count", nullable = false)
    @Builder.Default
    private Integer noShowCount = 0;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    public enum TruckStatus {
        AVAILABLE, EN_ROUTE, EMPTY_RETURN, OFFLINE, SHADOW_BANNED
    }
}
