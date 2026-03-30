package com.loadsetu.vahansync.repository;

import com.loadsetu.vahansync.entity.OutboxEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {

    /**
     * Scheduler query: fetch PENDING events due for relay.
     * Ordered by created_at to preserve event ordering within a topic.
     * Limit 50 per sweep to avoid overwhelming Kafka on backlog recovery.
     */
    @Query("""
            SELECT o FROM OutboxEvent o
            WHERE o.status = :status
              AND (o.nextAttemptAt IS NULL OR o.nextAttemptAt <= :now)
            ORDER BY o.createdAt ASC
            """)
    List<OutboxEvent> findDueForRelay(
            @Param("status") OutboxEvent.OutboxStatus status,
            @Param("now") LocalDateTime now,
            Pageable pageable
    );

    /** DLQ monitoring endpoint — returns events stuck in DLQ state. */
    List<OutboxEvent> findByStatusOrderByCreatedAtDesc(OutboxEvent.OutboxStatus status);
}
