package com.loadsetu.vahansync.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Booking entity — V4 final.
 *
 * V4 addition: driverId field.
 * The Booking already stores truckId (the vehicle). driverId stores the
 * authenticated User.id of the driver who confirmed the booking.
 * This is needed for:
 *   - PaymentController IDOR check: booking.driverId == authenticated user
 *   - Future driver-specific reporting and payout flows
 *   - Audit trail: who accepted this booking, not just which truck
 *
 * All V2/V3 fields unchanged (FRAUD_ATTEMPT, DRIVER_NO_SHOW, ML fields).
 */
@Entity
@Table(
    name = "bookings",
    indexes = {
        @Index(name = "idx_booking_truck_id",  columnList = "truck_id"),
        @Index(name = "idx_booking_load_id",   columnList = "load_id"),
        @Index(name = "idx_booking_driver_id", columnList = "driver_id"),
        @Index(name = "idx_booking_status",    columnList = "status"),
        @Index(name = "idx_booking_created",   columnList = "created_at")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "truck_id", nullable = false)
    private UUID truckId;

    @Column(name = "load_id", nullable = false)
    private UUID loadId;

    /**
     * V4: driverId = User.id of the authenticated driver who confirmed this booking.
     * Distinct from truckId (the vehicle). Used for IDOR checks in payment flow.
     * Null for bookings created pre-V4 (backward-compatible migration).
     */
    @Column(name = "driver_id")
    private UUID driverId;

    @Column(name = "agreed_payout", nullable = false, precision = 12, scale = 2)
    private BigDecimal agreedPayout;

    // ─── ML Analytics Fields (from V2) ───────────────────────────────────────

    @Min(0)
    @Column(name = "deadhead_km")
    private Double deadheadKm;

    @DecimalMin("0.0") @DecimalMax("1.0")
    @Column(name = "confidence_score")
    private Double confidenceScore;

    @Column(name = "original_payout_inr", precision = 12, scale = 2)
    private BigDecimal originalPayoutInr;

    // ─── Fintech Fields (from V2) ─────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private BookingStatus status = BookingStatus.AWAITING_PAYMENT;

    /** WhatsApp message ID — idempotency key. */
    @Column(name = "source_message_id", length = 100)
    private String sourceMessageId;

    /**
     * The exact fee the driver must pay to confirm this booking.
     * Cross-verified in payment webhook: webhook.amount MUST == this value.
     * Any mismatch → FRAUD_ATTEMPT.
     */
    @Column(name = "driver_match_fee", precision = 10, scale = 2)
    private BigDecimal driverMatchFee;

    public BigDecimal getExpectedMatchFee() {
        return driverMatchFee;
    }

    @Column(name = "payment_gateway_id", unique = true, length = 100)
    private String paymentGatewayId;

    @CreatedDate
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    // ─── Status Enum (V2 + DRIVER_NO_SHOW + FRAUD_ATTEMPT) ───────────────────

    public enum BookingStatus {
        AWAITING_PAYMENT,
        CONFIRMED,
        IN_TRANSIT,
        COMPLETED,
        CANCELLED,
        DRIVER_NO_SHOW,
        FRAUD_ATTEMPT
    }
}
