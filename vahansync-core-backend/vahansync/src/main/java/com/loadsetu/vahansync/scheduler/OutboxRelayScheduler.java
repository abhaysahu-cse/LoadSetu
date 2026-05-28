package com.loadsetu.vahansync.scheduler;

import com.loadsetu.vahansync.entity.OutboxEvent;
import com.loadsetu.vahansync.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

/**
 * RESILIENT OUTBOX RELAY SCHEDULER — V2.
 *
 * Polls the outbox_events table every 5 seconds and publishes
 * PENDING events to Kafka. On failure, applies exponential backoff:
 *
 *   Attempt 1 failure → nextAttemptAt = now + 30s
 *   Attempt 2 failure → nextAttemptAt = now + 60s
 *   Attempt 3 failure → nextAttemptAt = now + 120s
 *   Attempt 4 failure → nextAttemptAt = now + 240s
 *   Attempt 5 failure → nextAttemptAt = now + 480s
 *   retryCount > 5    → status = DLQ (manual intervention required)
 *
 * This guarantees at-least-once Kafka delivery even across:
 *   - Kafka broker restarts
 *   - Network partitions
 *   - Application pod restarts
 *
 * DLQ entries are exposed via GET /api/v1/admin/outbox/dlq for ops team.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OutboxRelayScheduler {

    private final OutboxEventRepository outboxRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${loadsetu.outbox.max-retries:5}")
    private int maxRetries;

    @Value("${loadsetu.outbox.initial-backoff-seconds:30}")
    private long initialBackoffSeconds;

    /**
     * Runs every 5 seconds.
     * fixedDelay ensures next sweep doesn't start until current one finishes,
     * preventing overlapping sweeps during Kafka backpressure.
     */
    @Scheduled(fixedDelayString = "5000")
    @Transactional
    public void relayPendingEvents() {
        List<OutboxEvent> dueEvents = outboxRepository.findDueForRelay(
                OutboxEvent.OutboxStatus.PENDING,
                LocalDateTime.now(),
                PageRequest.of(0, 50)
        );

        if (dueEvents.isEmpty()) return;

        log.debug("Outbox relay sweep: {} events due", dueEvents.size());

        for (OutboxEvent event : dueEvents) {
            publishEvent(event);
        }
    }

    private void publishEvent(OutboxEvent event) {
        try {
            kafkaTemplate.send(event.getTopic(), event.getMessageKey(), event.getPayload())
                    .get(); // Blocking get — confirm broker ack before marking PUBLISHED

            event.setStatus(OutboxEvent.OutboxStatus.PUBLISHED);
            event.setPublishedAt(Instant.now());
            outboxRepository.save(event);

            if ("load-events".equals(event.getTopic())) {
                log.info("[EVENT PUBLISHED] loadId={} topic={}", event.getAggregateId(), event.getTopic());
            }
            log.info("Outbox published: id={} topic={} aggregate={}",
                    event.getId(), event.getTopic(), event.getAggregateId());

        } catch (Exception ex) {
            handlePublishFailure(event, ex);
        }
    }

    private void handlePublishFailure(OutboxEvent event, Exception ex) {
        int newRetryCount = event.getRetryCount() + 1;
        event.setRetryCount(newRetryCount);
        event.setLastError(ex.getMessage() != null
                ? ex.getMessage().substring(0, Math.min(ex.getMessage().length(), 500))
                : "Unknown error");

        if (newRetryCount > maxRetries) {
            // Exceeded max retries — move to Dead Letter Queue
            event.setStatus(OutboxEvent.OutboxStatus.DLQ);
            log.error("OUTBOX DLQ: event={} aggregate={} topic={} after {} retries. "
                    + "Manual inspection required.",
                    event.getId(), event.getAggregateId(), event.getTopic(), newRetryCount);
            // TODO: Fire PagerDuty / Slack alert here
        } else {
            // Exponential backoff: initialBackoffSeconds * 2^(retryCount-1)
            long backoffSeconds = initialBackoffSeconds * (1L << (newRetryCount - 1));
            event.setNextAttemptAt(LocalDateTime.now().plusSeconds(backoffSeconds));
            event.setStatus(OutboxEvent.OutboxStatus.PENDING);
            log.warn("Outbox publish failed (attempt {}): id={} topic={} nextRetryIn={}s error={}",
                    newRetryCount, event.getId(), event.getTopic(),
                    backoffSeconds, ex.getMessage());
        }

        outboxRepository.save(event);
    }
}
