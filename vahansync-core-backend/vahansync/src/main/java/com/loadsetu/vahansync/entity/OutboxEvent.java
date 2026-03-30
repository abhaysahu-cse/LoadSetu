package com.loadsetu.vahansync.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * TRANSACTIONAL OUTBOX PATTERN — V2 Kafka Reliability.
 *
 * Instead of publishing to Kafka directly inside a database transaction
 * (which creates a dual-write problem), we write an OutboxEvent to this
 * table within the SAME transaction as the Booking save.
 *
 * The OutboxRelayScheduler polls this table every 5 seconds and publishes
 * pending events to Kafka. On failure, it applies exponential backoff.
 * After maxRetries (default 5), the event transitions to DLQ status for
 * manual inspection by the engineering team.
 *
 * This guarantees: if the booking is saved, the Kafka event WILL eventually
 * be published — even across server restarts, network blips, or Kafka downtime.
 */
@Entity
@Table(
    name = "outbox_events",
    indexes = {
        @Index(name = "idx_outbox_status",      columnList = "status"),
        @Index(name = "idx_outbox_next_attempt", columnList = "next_attempt_at"),
        @Index(name = "idx_outbox_aggregate",   columnList = "aggregate_id")
    }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    /** e.g. "Booking", "Load", "Truck" */
    @Column(name = "aggregate_type", nullable = false, length = 50)
    private String aggregateType;

    /** The UUID of the Booking/Load/Truck that triggered this event. */
    @Column(name = "aggregate_id", nullable = false)
    private UUID aggregateId;

    /** Kafka topic to publish to (e.g. "booking-events"). */
    @Column(name = "topic", nullable = false, length = 100)
    private String topic;

    /** Kafka message key (usually aggregateId.toString()). */
    @Column(name = "message_key", length = 200)
    private String messageKey;

    /** Full JSON payload to publish. Stored as TEXT — no size limit. */
    @Column(name = "payload", nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private OutboxStatus status = OutboxStatus.PENDING;

    /**
     * V2 — Exponential backoff counter.
     * Backoff formula: initialBackoffSeconds * 2^retryCount
     * e.g. 30s → 60s → 120s → 240s → 480s → DLQ
     */
    @Column(name = "retry_count", nullable = false)
    @Builder.Default
    private Integer retryCount = 0;

    /**
     * V2 — Next scheduled relay attempt.
     * Set by OutboxRelayScheduler after each failed publish.
     * Scheduler skips rows where nextAttemptAt > NOW().
     */
    @Column(name = "next_attempt_at")
    private LocalDateTime nextAttemptAt;

    /** Error message from the last failed Kafka publish attempt. */
    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    public enum OutboxStatus {
        PENDING,    // Awaiting relay
        PUBLISHED,  // Successfully sent to Kafka
        FAILED,     // Last attempt failed; will retry
        DLQ         // Exceeded maxRetries — requires manual intervention
    }
}
