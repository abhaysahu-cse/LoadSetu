package com.loadsetu.vahansync.controller;

import com.loadsetu.vahansync.dto.Dtos.PaymentConfirmRequest;
import com.loadsetu.vahansync.dto.Dtos.PaymentOrderResponse;
import com.loadsetu.vahansync.entity.Booking;
import com.loadsetu.vahansync.repository.BookingRepository;
import com.loadsetu.vahansync.service.PaymentGatewayService;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

/**
 * Payment Order Controller — V4.
 *
 * POST /api/v1/payments/create-order/{bookingId}
 *   — JWT-protected (driver must be authenticated)
 *   — IDOR check: booking.driverId MUST == authenticated user's UUID
 *   — Returns gatewayOrderId for React Native Razorpay SDK checkout
 *
 * Note: This is SEPARATE from PaymentWebhookController (POST /payments/webhook)
 * which receives the gateway's server-to-server confirmation after payment.
 *
 * Flow:
 *   1. React Native calls POST /payments/create-order/{bookingId}
 *   2. This endpoint verifies ownership and calls PaymentGatewayService
 *   3. Returns { gateway_order_id, amount, currency, booking_id }
 *   4. React Native opens Razorpay checkout SDK with gateway_order_id
 *   5. Driver pays — Razorpay calls our /payments/webhook
 *   6. PaymentWebhookService verifies amount and confirms booking
 */
@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final BookingRepository    bookingRepository;
    private final PaymentGatewayService paymentGatewayService;

    /**
     * Initialize a Razorpay payment order for a booking.
     *
     * Security model:
     *   - JWT required (SecurityConfig Tier 3)
     *   - @AuthenticationPrincipal extracts userId from JWT subject (our standard pattern)
     *   - findByIdAndDriverId() enforces ownership — a driver cannot initiate payment
     *     for another driver's booking even if they know the bookingId UUID
     *   - Returns 404 (not 403) for both "not found" and "not authorized"
     *     to avoid confirming booking existence to unauthorized callers
     *
     * @param bookingId UUID of the booking to pay for (from URL path)
     * @param userId    UUID of the authenticated driver (from JWT — never from request body)
     */
    @PostMapping("/create-order/{bookingId}")
    public PaymentOrderResponse createPaymentOrder(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal String userId) {

        UUID driverId = UUID.fromString(userId);

        // IDOR check: findByIdAndDriverId returns empty if booking doesn't belong to this driver
        Booking booking = bookingRepository.findByIdAndDriverId(bookingId, driverId)
                .orElseThrow(() -> {
                    log.warn("Payment order IDOR attempt: bookingId={} requestingDriverId={}",
                            bookingId, driverId);
                    return new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found");
                });

        // Only AWAITING_PAYMENT bookings should be paid
        if (booking.getStatus() != Booking.BookingStatus.AWAITING_PAYMENT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Booking is not awaiting payment. Current status: " + booking.getStatus());
        }

        if (booking.getDriverMatchFee() == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Booking has no driver match fee configured. Contact support.");
        }

        // Create gateway order
        String gatewayOrderId = paymentGatewayService.createOrder(
                booking.getDriverMatchFee(), booking.getId());

        log.info("Payment order created: bookingId={} gatewayOrderId={} amount={}",
                bookingId, gatewayOrderId, booking.getDriverMatchFee());

        return PaymentOrderResponse.builder()
                .gatewayOrderId(gatewayOrderId)
                .amount(booking.getDriverMatchFee())
                .currency("INR")
                .bookingId(booking.getId())
                .build();
    }

    @PostMapping("/confirm")
    @Transactional
    public ResponseEntity<?> confirmPayment(@Valid @RequestBody PaymentConfirmRequest req) {
        Booking booking = bookingRepository.findByIdForUpdate(req.getBookingId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        if (booking.getPaymentGatewayId() != null) {
            throw new SecurityException("Payment already processed.");
        }

        if (booking.getStatus() == Booking.BookingStatus.CONFIRMED) {
            return ResponseEntity.ok(Map.of("status", "Already confirmed"));
        }

        if (req.getAmountPaid().compareTo(booking.getExpectedMatchFee()) != 0) {
            throw new SecurityException("FRAUD ALERT: Amount mismatch.");
        }

        boolean valid = paymentGatewayService.verifyPaymentSignature(
                req.getPaymentId(), booking.getId().toString(), req.getSignature());

        if (!valid) {
            throw new SecurityException("FRAUD ALERT: Invalid signature.");
        }

        booking.setPaymentGatewayId(req.getPaymentId());
        booking.setStatus(Booking.BookingStatus.CONFIRMED);
        bookingRepository.save(booking);

        return ResponseEntity.ok(Map.of("status", "Payment Confirmed"));
    }
}
