package com.loadsetu.vahansync.repository;

import com.loadsetu.vahansync.entity.PaymentAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PaymentAuditLogRepository extends JpaRepository<PaymentAuditLog, UUID> {
    List<PaymentAuditLog> findByBookingIdOrderByCreatedAtDesc(UUID bookingId);
    List<PaymentAuditLog> findByIsFraudSuspectedTrueOrderByCreatedAtDesc();
}
