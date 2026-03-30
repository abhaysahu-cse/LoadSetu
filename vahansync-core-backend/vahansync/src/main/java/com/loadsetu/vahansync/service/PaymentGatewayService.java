package com.loadsetu.vahansync.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Payment Gateway Service — V4.
 *
 * Abstracts Razorpay / Cashfree order creation behind a single interface.
 * The PaymentController uses this to initialize a payment order before
 * the driver opens the checkout SDK on React Native.
 *
 * CURRENT STATE: MOCK implementation.
 * Returns "order_mock_{UUID}" so the React Native app can test the
 * full payment flow today without real Razorpay credentials.
 *
 * TO INTEGRATE RAZORPAY:
 *   1. Add dependency: com.razorpay:razorpay-java:1.4.5
 *   2. Set env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
 *   3. Replace createOrder() body with:
 *        RazorpayClient client = new RazorpayClient(keyId, keySecret);
 *        JSONObject options = new JSONObject();
 *        options.put("amount", amount.multiply(BigDecimal.valueOf(100)).intValue()); // paise
 *        options.put("currency", "INR");
 *        options.put("receipt", "booking_" + bookingId);
 *        Order order = client.orders.create(options);
 *        return order.get("id");
 *
 * HMAC WEBHOOK VERIFICATION (PaymentWebhookController):
 *   String expectedSignature = HmacUtils.hmacSha256Hex(keySecret,
 *       razorpayOrderId + "|" + razorpayPaymentId);
 *   if (!expectedSignature.equals(razorpaySignature)) throw 400;
 */
@Service
@Slf4j
public class PaymentGatewayService {

    @Value("${loadsetu.payment.razorpay.key-id:mock}")
    private String razorpayKeyId;

    @Value("${loadsetu.payment.razorpay.key-secret:mock}")
    private String razorpayKeySecret;

    @Value("${loadsetu.payment.mock-enabled:true}")
    private boolean mockEnabled;

    /**
     * Creates a payment order with the configured gateway.
     *
     * @param amount    Amount in INR (will be converted to paise for gateway)
     * @param bookingId Used as the order receipt/reference
     * @return          Gateway order ID (e.g., "order_ABC123" from Razorpay)
     */
    public String createOrder(BigDecimal amount, UUID bookingId) {
        if (mockEnabled) {
            String mockOrderId = "order_mock_" + UUID.randomUUID().toString().replace("-", "").substring(0, 14);
            log.info("[MOCK-PAYMENT] Order created: orderId={} amount=₹{} bookingId={}",
                    mockOrderId, amount, bookingId);
            return mockOrderId;
        }

        return createRazorpayOrder(amount, bookingId);
    }

    private String createRazorpayOrder(BigDecimal amount, UUID bookingId) {
        // TODO: Replace with live Razorpay SDK call (see Javadoc above)
        throw new UnsupportedOperationException(
                "Live Razorpay integration not yet configured. Set loadsetu.payment.mock-enabled=true");
    }

    /**
     * Verifies the client-side payment success signature.
     *
     * For the current launch build, we use bookingId|paymentId as the signed payload.
     * That keeps the mobile and backend flow verifiable without storing gateway order IDs.
     * When live gateway SDK wiring is completed, this can be upgraded to the provider's
     * canonical signature format without changing the controller contract.
     */
    public boolean verifyPaymentSignature(UUID bookingId, String paymentId, String signature) {
        return verifyPaymentSignature(paymentId, bookingId.toString(), signature);
    }

    public boolean verifyPaymentSignature(String paymentId, String bookingId, String signature) {
        if (mockEnabled && "mock-success".equalsIgnoreCase(signature)) {
            return true;
        }
        String expected = hmacSha256Hex(bookingId + "|" + paymentId, razorpayKeySecret);
        return expected.equalsIgnoreCase(signature);
    }

    public String getPublicKey() {
        return razorpayKeyId;
    }

    private String hmacSha256Hex(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to verify payment signature", ex);
        }
    }
}
