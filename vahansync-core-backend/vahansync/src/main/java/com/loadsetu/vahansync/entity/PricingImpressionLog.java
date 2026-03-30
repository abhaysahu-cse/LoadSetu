package com.loadsetu.vahansync.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * ML ANALYTICS PIPELINE — XGBoost Training Data Foundation.
 *
 * Every WhatsApp "teaser" sent by the FastAPI service is logged here.
 * This table is the ground truth for the pricing model:
 * - What payout was offered?
 * - How far was the deadhead?
 * - How many trucks were competing in that area?
 * - Did the driver accept, reject, or ignore?
 *
 * The XGBoost model trains on driver_response to learn optimal
 * pricing that maximizes acceptance rate while protecting margin.
 *
 * driver_whatsapp is MASKED at insert time (last 4 digits only)
 * for PDPA/DPDP compliance. Full number is never stored here.
 */
@Entity
@Table(
    name = "pricing_impression_logs",
    indexes = {
        @Index(name = "idx_pil_load_id",     columnList = "load_id"),
        @Index(name = "idx_pil_response",    columnList = "driver_response"),
        @Index(name = "idx_pil_timestamp",   columnList = "timestamp")
    }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PricingImpressionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "load_id", nullable = false)
    private UUID loadId;

    /**
     * Masked phone number: "+91XXXXXX4321" — last 4 digits only.
     * Full number must never be stored for DPDP Act compliance.
     */
    @Column(name = "driver_whatsapp_masked", length = 20)
    private String driverWhatsappMasked;

    /** Payout offered in the WhatsApp teaser (INR). */
    @Column(name = "offered_payout_inr")
    private Double offeredPayoutInr;

    /** Deadhead km from truck position to load origin at time of teaser. */
    @Column(name = "deadhead_km")
    private Double deadheadKm;

    /**
     * Number of available trucks within 50km radius at teaser time.
     * Low supply = higher pricing power. Key XGBoost feature.
     */
    @Column(name = "local_truck_supply")
    private Integer localTruckSupply;

    /**
     * End-to-end latency of the AI matching engine (ms).
     * Tracks FastAPI response time for SLA monitoring.
     */
    @Column(name = "response_time_ms")
    private Long responseTimeMs;

    @Enumerated(EnumType.STRING)
    @Column(name = "driver_response", length = 20)
    private DriverResponse driverResponse;

    @CreationTimestamp
    @Column(name = "timestamp", updatable = false, nullable = false)
    private Instant timestamp;

    public enum DriverResponse {
        ACCEPTED,   // Driver replied YES to the WhatsApp teaser
        REJECTED,   // Driver explicitly declined
        IGNORED     // No response within TTL window (default 10 minutes)
    }
}
