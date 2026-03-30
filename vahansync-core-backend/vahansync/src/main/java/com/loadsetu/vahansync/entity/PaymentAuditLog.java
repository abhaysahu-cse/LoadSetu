package com.loadsetu.vahansync.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * ISOLATED FINTECH AUDIT LOG — V2 Spec.
 *
 * Every incoming payment webhook payload is written to this table
 * BEFORE any booking logic executes. This write uses
 * Propagation.REQUIRES_NEW — it commits independently, even if the
 * outer booking transaction rolls back.
 *
 * This is the legally defensible audit trail. Never delete rows from
 * this table. In production, replicate to an immutable S3 data lake.
 *
 * isFraudSuspected = true when webhook_amount != booking.driverMatchFee.
 */
@Entity
@Table(
    name = "payment_audit_logs",
    indexes = {
        @Index(name = "idx_pal_booking_id",     columnList = "booking_id"),
        @Index(name = "idx_pal_gateway_ref",    columnList = "gateway_reference"),
        @Index(name = "idx_pal_fraud",          columnList = "is_fraud_suspected"),
        @Index(name = "idx_pal_created",        columnList = "created_at")
    }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PaymentAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    /** The booking this payment pertains to. May be null if booking_id is forged. */
    @Column(name = "booking_id")
    private UUID bookingId;

    /** Amount received in the webhook payload (rupees). */
    @Column(name = "webhook_amount", precision = 12, scale = 2)
    private BigDecimal webhookAmount;

    /** Amount expected (booking.driverMatchFee). Used for fraud comparison. */
    @Column(name = "expected_amount", precision = 12, scale = 2)
    private BigDecimal expectedAmount;

    /** Payment gateway transaction reference (Razorpay/Stripe order_id). */
    @Column(name = "gateway_reference", length = 200)
    private String gatewayReference;

    /** Payment gateway name: RAZORPAY, STRIPE, UPI, etc. */
    @Column(name = "gateway_name", length = 50)
    private String gatewayName;

    /** Full raw JSON payload from the gateway — never truncated. */
    @Column(name = "raw_payload", columnDefinition = "TEXT")
    private String rawPayload;

    /** Status reported by gateway: SUCCESS, FAILED, PENDING, REFUNDED. */
    @Column(name = "gateway_status", length = 50)
    private String gatewayStatus;

    /**
     * V2 FRAUD FLAG.
     * true when webhookAmount != expectedAmount.
     * Triggers FRAUD_ATTEMPT transition on Booking and alerts on-call engineer.
     */
    @Column(name = "is_fraud_suspected", nullable = false)
    @Builder.Default
    private Boolean isFraudSuspected = false;

    /** IP address of webhook sender — for fraud pattern analysis. */
    @Column(name = "sender_ip", length = 50)
    private String senderIp;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;
}
