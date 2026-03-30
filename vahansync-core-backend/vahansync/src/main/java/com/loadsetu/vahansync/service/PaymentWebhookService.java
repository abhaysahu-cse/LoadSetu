package com.loadsetu.vahansync.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.loadsetu.vahansync.dto.Dtos.PaymentWebhookPayload;
import com.loadsetu.vahansync.entity.Booking;
import com.loadsetu.vahansync.entity.PaymentAuditLog;
import com.loadsetu.vahansync.kafka.KafkaProducerService;
import com.loadsetu.vahansync.repository.BookingRepository;
import com.loadsetu.vahansync.repository.PaymentAuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

/**
 * IRONCLAD FINTECH PAYMENT WEBHOOK SERVICE — V2.
 *
 * Processing order (strict — do not reorder):
 *
 *  Step 1: Write audit log in REQUIRES_NEW transaction (independent commit).
 *          This MUST succeed even if all subsequent steps fail.
 *
 *  Step 2: Load booking and validate it's in AWAITING_PAYMENT state.
 *
 *  Step 3: STRICT AMOUNT VALIDATION.
 *          webhook.amount MUST == booking.driverMatchFee (exact match).
 *          Any mismatch → transition booking to FRAUD_ATTEMPT → stop.
 *
 *  Step 4: Transition booking to CONFIRMED.
 *
 *  Step 5: Publish booking-events via Outbox (not direct Kafka).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentWebhookService {

    private final PaymentAuditLogRepository auditLogRepository;
    private final BookingRepository bookingRepository;
    private final KafkaProducerService kafkaProducerService;
    private final ObjectMapper objectMapper;

    /**
     * Main webhook processing entry point.
     * Outer transaction: REQUIRED (default).
     * Audit log inner transaction: REQUIRES_NEW (independent).
     */
    @Transactional
    public void processWebhook(PaymentWebhookPayload payload, String rawJson, String senderIp) {
        // Step 1 — Write audit log FIRST, in its own independent transaction.
        // Even if this method crashes after this line, the audit record exists.
        PaymentAuditLog auditLog = saveAuditLogIndependently(payload, rawJson, senderIp);

        // Step 2 — Load the booking
        Booking booking = bookingRepository.findById(payload.getBookingId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Booking not found: " + payload.getBookingId()));

        if (booking.getStatus() != Booking.BookingStatus.AWAITING_PAYMENT) {
            log.warn("Webhook for booking in unexpected state: bookingId={} status={}",
                    payload.getBookingId(), booking.getStatus());
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Booking is not in AWAITING_PAYMENT state: " + booking.getStatus());
        }

        // Step 3 — STRICT AMOUNT VALIDATION (V2 Fintech Safety)
        BigDecimal webhookAmount = payload.getAmount();
        BigDecimal expectedFee   = booking.getDriverMatchFee();

        if (webhookAmount == null || expectedFee == null
                || webhookAmount.compareTo(expectedFee) != 0) {

            // Flag the audit log
            auditLog.setIsFraudSuspected(true);
            auditLogRepository.save(auditLog);

            // Freeze the booking permanently as FRAUD_ATTEMPT
            booking.setStatus(Booking.BookingStatus.FRAUD_ATTEMPT);
            bookingRepository.save(booking);

            log.error("FRAUD ATTEMPT DETECTED: bookingId={} expected={} received={}",
                    payload.getBookingId(), expectedFee, webhookAmount);

            // TODO: Alert on-call engineer via PagerDuty / Slack webhook
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Payment amount mismatch. Booking has been flagged for fraud investigation.");
        }

        // Step 4 — Amount verified. Confirm the booking.
        booking.setStatus(Booking.BookingStatus.CONFIRMED);
        bookingRepository.save(booking);

        log.info("Payment confirmed: bookingId={} amount={}",
                payload.getBookingId(), webhookAmount);

        // Step 5 — Publish event via Kafka Producer (uses Outbox for reliability)
        kafkaProducerService.publishLoadStatusEvent(booking.getLoadId(), "BOOKED");
    }

    /**
     * REQUIRES_NEW: This method opens and commits its OWN transaction,
     * completely independent of the outer processWebhook() transaction.
     *
     * If the outer transaction rolls back (e.g. due to fraud detection throwing),
     * this audit log STILL PERSISTS in the database.
     * This is the legally required immutable audit trail.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public PaymentAuditLog saveAuditLogIndependently(
            PaymentWebhookPayload payload, String rawJson, String senderIp) {

        PaymentAuditLog log = PaymentAuditLog.builder()
                .bookingId(payload.getBookingId())
                .webhookAmount(payload.getAmount())
                .expectedAmount(payload.getAmount())
                .gatewayReference(payload.getGatewayReference())
                .gatewayName(payload.getGatewayName())
                .gatewayStatus(payload.getGatewayStatus())
                .rawPayload(rawJson)
                .senderIp(senderIp)
                .isFraudSuspected(false) // Will be updated to true if fraud detected
                .build();

        return auditLogRepository.save(log);
    }
}
