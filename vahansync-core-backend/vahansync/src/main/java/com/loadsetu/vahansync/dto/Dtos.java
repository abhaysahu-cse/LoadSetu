package com.loadsetu.vahansync.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.loadsetu.vahansync.entity.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * All API DTOs — VahanSync Core Engine V4 Final.
 *
 * V4 additions:
 *   - RegisterShipperRequest: phone + password + companyName
 *   - CreateLoadRequest: originName/lat/lng + destination + capacity/payout/pickupTime
 *   - PaymentOrderResponse: gatewayOrderId + amount
 */
public final class Dtos {

    private Dtos() {}

    // ═══════════════════════════════════════════════════════════════════════════
    //  AUTH
    // ═══════════════════════════════════════════════════════════════════════════

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class AuthRequest {
        @NotBlank(message = "phone is required")  private String phone;
        @NotBlank(message = "password is required") private String password;
    }

    /** Generic registration (driver / fleet owner). */
    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class RegisterRequest {
        @NotBlank                   private String fullName;
        @NotBlank                   private String phone;
        @NotBlank @Size(min = 8)    private String password;
        @NotNull                    private User.UserRole role;
        /** Optional: company name for FLEET_OWNER accounts. */
        private String companyName;
    }

    /**
     * V4 — Shipper-specific registration.
     * Dedicated endpoint so the Next.js onboarding form can send
     * companyName as a required field for SHIPPER accounts.
     */
    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class RegisterShipperRequest {
        @NotBlank(message = "phone is required")
        private String phone;

        @NotBlank @Size(min = 8, message = "password must be at least 8 characters")
        private String password;

        @NotBlank(message = "companyName is required for shipper accounts")
        private String companyName;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class RegisterDriverRequest {
        @NotBlank(message = "phone is required")
        private String phone;

        @NotBlank @Size(min = 8, message = "password must be at least 8 characters")
        private String password;

        @NotBlank(message = "fullName is required")
        private String fullName;

        @NotBlank(message = "truckNumber is required")
        private String truckNumber;

        @NotNull @DecimalMin(value = "0.1", message = "capacity must be greater than 0")
        @DecimalMax(value = "50.0", message = "capacity must be at most 50 tons")
        private Double capacity;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AuthResponse {
        private String  token;
        @JsonProperty("expires_in") private long   expiresIn;
        @JsonProperty("user_id")    private UUID   userId;
        private String  role;
        @JsonProperty("full_name") private String fullName;
        @JsonProperty("truck_id") private UUID truckId;
        /** Present for SHIPPER / FLEET_OWNER accounts. Null for DRIVER. */
        @JsonProperty("company_name") private String companyName;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  LOAD MATCHING
    // ═══════════════════════════════════════════════════════════════════════════

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MatchRequest {
        @NotNull @JsonProperty("truck_id")           private UUID   truckId;
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0")
        @JsonProperty("current_location_lat")        private Double currentLocationLat;
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0")
        @JsonProperty("current_location_lng")        private Double currentLocationLng;
        @NotNull @JsonProperty("empty_at_timestamp") private Instant emptyAtTimestamp;
        @NotNull @DecimalMin("0.1")
        @JsonProperty("capacity_tons")               private Double capacityTons;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MatchCandidate {
        @JsonProperty("load_id")          private UUID       loadId;
        private String origin;
        private String destination;
        @JsonProperty("payout_inr")       private BigDecimal payoutInr;
        @JsonProperty("deadhead_km")      private Double     deadheadKm;
        @JsonProperty("confidence_score") @Builder.Default private Double confidenceScore = 1.0;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MatchResponse {
        private List<MatchCandidate> matches;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  V4 — SINGLE LOAD CREATION (Next.js Dashboard → Spring Boot)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Sent by the Next.js dashboard when a shipper posts a new load.
     * originLat/Lng and destLat/Lng are converted to PostGIS geometry(Point,4326)
     * inside LoadService.createSingleLoad() using JTS GeometryFactory.
     *
     * Note: longitude comes before latitude in WGS84/PostGIS convention
     * (ST_MakePoint(lng, lat) — not the intuitive lat/lng order).
     * The service layer handles this conversion transparently.
     */
    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateLoadRequest {

        @NotBlank(message = "originName is required")
        private String originName;

        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0")
        private Double originLat;

        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0")
        private Double originLng;

        @NotBlank(message = "destinationName is required")
        private String destinationName;

        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0")
        private Double destLat;

        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0")
        private Double destLng;

        /** Must be > 0 and <= 50 tons. */
        @NotNull @DecimalMin("0.1") @DecimalMax("50.0")
        private Double requiredCapacity;

        @NotNull @DecimalMin("1.0")
        private BigDecimal payoutInr;

        @NotNull
        private Instant pickupTime;
    }

    /** Returned after successful single-load creation. */
    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateLoadResponse {
        private UUID   loadId;
        private String originName;
        private String destinationName;
        private String status;
        private Instant createdAt;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  LOAD DETAIL (GET /loads/{id})
    // ═══════════════════════════════════════════════════════════════════════════

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class LoadDetailResponse {
        private UUID       id;
        private String     originName;
        private String     destinationName;
        private Double     requiredCapacity;
        private BigDecimal payoutInr;
        private Instant    pickupTime;
        private String     status;
        private Instant    createdAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class NearbyLoadResponse {
        private UUID id;
        private String originName;
        private Double originLat;
        private Double originLng;
        private String destinationName;
        private Double destinationLat;
        private Double destinationLng;
        private Double requiredCapacity;
        private BigDecimal payoutInr;
        private String shipperName;
        private String status;
        private Instant pickupTime;
        private Double distanceKm;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MapViewLoadResponse {
        private UUID id;
        private Double lat;
        private Double lng;
        private BigDecimal payoutInr;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class InternalLoadSearchRequest {
        @JsonProperty("h3_indexes") private List<String> h3Indexes;
        @JsonProperty("min_capacity_tons") private Double minCapacityTons;
        @JsonProperty("available_before") private Instant availableBefore;
        private String status;
        @Builder.Default private Integer limit = 50;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class InternalLoadRecord {
        @JsonProperty("load_id") private UUID loadId;
        @JsonProperty("shipper_id") private UUID shipperId;
        @JsonProperty("shipper_name") private String shipperName;
        private String origin;
        @JsonProperty("origin_lat") private Double originLat;
        @JsonProperty("origin_lng") private Double originLng;
        @JsonProperty("origin_h3_index") private String originH3Index;
        private String destination;
        @JsonProperty("destination_lat") private Double destinationLat;
        @JsonProperty("destination_lng") private Double destinationLng;
        @JsonProperty("weight_tons") private Double weightTons;
        @JsonProperty("load_type") private String loadType;
        @JsonProperty("base_price_inr") private BigDecimal basePriceInr;
        private String status;
        @JsonProperty("time_window_start") private Instant timeWindowStart;
        @JsonProperty("time_window_end") private Instant timeWindowEnd;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class InternalLoadSearchResponse {
        private List<InternalLoadRecord> loads;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  BOOKING
    // ═══════════════════════════════════════════════════════════════════════════

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class BookingRequest {
        @NotNull @JsonProperty("truck_id")      private UUID       truckId;
        @NotNull @JsonProperty("load_id")       private UUID       loadId;
        @NotNull @JsonProperty("agreed_payout") private BigDecimal agreedPayout;
        @JsonProperty("deadhead_km")            private Double     deadheadKm;
        @JsonProperty("confidence_score")       private Double     confidenceScore;
        @JsonProperty("source_message_id")      private String     sourceMessageId;
        @JsonProperty("driver_match_fee")       private BigDecimal driverMatchFee;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class BookingResponse {
        private UUID    bookingId;
        private String  status;
        private Instant createdAt;
        private String  message;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  V4 — PAYMENT ORDER (Initialize Razorpay/Cashfree order)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Response sent to React Native / Next.js after creating a payment order.
     * The mobile app uses gatewayOrderId to open the Razorpay checkout SDK.
     */
    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PaymentOrderResponse {
        @JsonProperty("gateway_order_id") private String     gatewayOrderId;
        @JsonProperty("amount")           private BigDecimal amount;
        @JsonProperty("currency")         @Builder.Default private String currency = "INR";
        @JsonProperty("booking_id")       private UUID       bookingId;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PaymentConfirmRequest {
        @NotNull(message = "bookingId is required")
        private UUID bookingId;

        @NotBlank(message = "paymentId is required")
        private String paymentId;

        @NotNull(message = "amountPaid is required")
        private BigDecimal amountPaid;

        @NotBlank(message = "signature is required")
        private String signature;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PaymentConfirmResponse {
        private UUID bookingId;
        private String paymentId;
        private String status;
        private String message;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class DeviceTokenRequest {
        @NotBlank(message = "fcmToken is required")
        private String fcmToken;
        private String deviceType;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class UserProfileResponse {
        @JsonProperty("user_id") private UUID userId;
        private String phone;
        private String name;
        private String role;
        @JsonProperty("company_name") private String companyName;
        @JsonProperty("truck_id") private UUID truckId;
        @JsonProperty("truck_number") private String truckNumber;
        @JsonProperty("truck_type") private String truckType;
        @JsonProperty("current_status") private String currentStatus;
        @JsonProperty("created_at") private Instant createdAt;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  PAYMENT WEBHOOK (from V2 — unchanged)
    // ═══════════════════════════════════════════════════════════════════════════

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PaymentWebhookPayload {
        @NotNull(message = "booking_id required")
        @JsonProperty("booking_id")         private UUID       bookingId;
        @NotNull @DecimalMin("0.01")        private BigDecimal amount;
        @NotBlank @JsonProperty("gateway_reference") private String gatewayReference;
        @JsonProperty("gateway_name")       private String     gatewayName;
        @JsonProperty("gateway_status")     private String     gatewayStatus;
        @Builder.Default                    private String     currency = "INR";
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  BULK LOAD INGESTION (from V2/V3 — unchanged)
    // ═══════════════════════════════════════════════════════════════════════════

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class BulkLoadRequest {
        @NotNull @Size(min = 1, max = 500) @Valid
        private List<LoadItemDto> loads;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class LoadItemDto {
        @NotBlank                                          private String     originCity;
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0")   private Double     originLat;
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0")  private Double     originLng;
        @NotBlank                                          private String     destinationCity;
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0")   private Double     destinationLat;
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0")  private Double     destinationLng;
        @NotNull @DecimalMin("0.1") @DecimalMax("50.0")    private Double     requiredCapacity;
        @NotNull @DecimalMin("1.0")                        private BigDecimal payoutInr;
        @NotNull                                           private Instant    pickupTime;
        @NotBlank                                          private String     pickupDate;
        @NotNull                                           private UUID       shipperId;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class BulkLoadResponse {
        private int totalReceived;
        private int accepted;
        private int duplicatesSkipped;
        private int rejected;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  KAFKA EVENTS (unchanged)
    // ═══════════════════════════════════════════════════════════════════════════

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class BookingEvent {
        @JsonProperty("event_type") @Builder.Default private String    eventType = "BOOKING_CONFIRMED";
        @JsonProperty("booking_id") private UUID       bookingId;
        @JsonProperty("truck_id")   private UUID       truckId;
        @JsonProperty("load_id")    private UUID       loadId;
        private String origin;
        private String destination;
        @JsonProperty("agreed_payout_inr") private BigDecimal agreedPayoutInr;
        @JsonProperty("deadhead_km")       private Double     deadheadKm;
        @JsonProperty("confidence_score")  private Double     confidenceScore;
        @Builder.Default                   private Instant    timestamp = Instant.now();
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class TruckTelemetryEvent {
        @JsonProperty("truck_id") private UUID    truckId;
        private Double  lat;
        private Double  lng;
        private Double  speedKmh;
        private Instant timestamp;
    }
}
