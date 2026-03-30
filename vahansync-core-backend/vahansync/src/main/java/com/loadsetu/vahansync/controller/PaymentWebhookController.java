package com.loadsetu.vahansync.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.loadsetu.vahansync.dto.Dtos.PaymentWebhookPayload;
import com.loadsetu.vahansync.service.PaymentWebhookService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Payment gateway webhook receiver.
 *
 * Protected by Bucket4j rate limiter (10 requests / 10 seconds per IP).
 * Applied via RateLimitInterceptor.
 *
 * IMPORTANT: This endpoint must return 200 quickly to prevent the payment
 * gateway from retrying. All heavy processing happens in PaymentWebhookService.
 * In production, add HMAC signature verification of the webhook payload
 * (Razorpay uses X-Razorpay-Signature header).
 */
@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@Slf4j
public class PaymentWebhookController {

    private final PaymentWebhookService webhookService;
    private final ObjectMapper objectMapper;

    /**
     * POST /api/v1/payments/webhook
     *
     * Receives payment confirmation from Razorpay/Stripe/UPI gateway.
     * Rate limited: 10 requests / 10 seconds (Bucket4j).
     *
     * Processing order:
     *  1. Capture raw body (before any deserialization failure can occur).
     *  2. Log audit record (REQUIRES_NEW transaction).
     *  3. Validate amount == booking.driverMatchFee.
     *  4. Confirm booking or flag FRAUD_ATTEMPT.
     */
    @PostMapping("/webhook")
    public ResponseEntity<Map<String, String>> receiveWebhook(
            @Valid @RequestBody PaymentWebhookPayload payload,
            HttpServletRequest request) {

        // Capture sender IP for audit log
        String senderIp = extractClientIp(request);

        // Capture raw JSON for the immutable audit trail
        String rawJson;
        try {
            rawJson = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            rawJson = "{\"error\":\"serialization_failed\"}";
        }

        log.info("Payment webhook received: bookingId={} gateway={} ip={}",
                payload.getBookingId(), payload.getGatewayName(), senderIp);

        webhookService.processWebhook(payload, rawJson, senderIp);

        // Payment gateways expect a 200 response to stop retrying
        return ResponseEntity.ok(Map.of(
                "status", "received",
                "message", "Payment processed successfully"
        ));
    }

    private String extractClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
