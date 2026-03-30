package com.loadsetu.vahansync.controller;

import com.loadsetu.vahansync.dto.Dtos.*;
import com.loadsetu.vahansync.entity.Booking;
import com.loadsetu.vahansync.entity.Load;
import com.loadsetu.vahansync.repository.BookingRepository;
import com.loadsetu.vahansync.repository.LoadRepository;
import com.loadsetu.vahansync.service.LoadService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Slf4j
public class LoadController {

    private final LoadService loadService;
    private final LoadRepository loadRepository;
    private final BookingRepository bookingRepository;

    @PostMapping("/loads/match")
    public ResponseEntity<MatchResponse> matchLoads(@Valid @RequestBody MatchRequest request) {
        log.debug("POST /api/v1/loads/match truck={}", request.getTruckId());
        return ResponseEntity.ok(loadService.matchLoads(request));
    }

    @PostMapping("/loads/bulk")
    public ResponseEntity<BulkLoadResponse> bulkIngestLoads(
            @Valid @RequestBody BulkLoadRequest request) {
        log.info("Bulk ingest: {} loads", request.getLoads().size());
        return ResponseEntity.ok(loadService.bulkIngestLoads(request));
    }

    @PostMapping("/loads")
    public ResponseEntity<CreateLoadResponse> createLoad(
            @Valid @RequestBody CreateLoadRequest request,
            @AuthenticationPrincipal String userId) {

        UUID shipperId = UUID.fromString(userId);
        CreateLoadResponse response = loadService.createSingleLoad(request, shipperId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/loads/nearby")
    public ResponseEntity<List<NearbyLoadResponse>> getNearbyLoads(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "50") double radius) {
        return ResponseEntity.ok(loadService.getNearbyLoads(lat, lng, radius));
    }

    @GetMapping("/loads/map-view")
    public ResponseEntity<List<MapViewLoadResponse>> getLoadsForMapView(
            @RequestParam double lat,
            @RequestParam double lng) {
        List<MapViewLoadResponse> loads = loadService.getNearbyLoads(lat, lng, 50).stream()
                .map(load -> MapViewLoadResponse.builder()
                        .id(load.getId())
                        .lat(load.getOriginLat())
                        .lng(load.getOriginLng())
                        .payoutInr(load.getPayoutInr())
                        .build())
                .toList();
        return ResponseEntity.ok(loads);
    }

    @GetMapping("/loads/{id}")
    public ResponseEntity<LoadDetailResponse> getLoad(
            @PathVariable UUID id,
            @AuthenticationPrincipal String userId,
            Authentication authentication) {

        UUID principalId = UUID.fromString(userId);
        boolean isShipper = authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_SHIPPER".equals(a.getAuthority()));
        boolean isDriver = authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_DRIVER".equals(a.getAuthority()));

        Load load = loadRepository.findById(id)
                .orElseThrow(() -> new java.util.NoSuchElementException("Load not found"));

        if (isShipper && !load.getShipperId().equals(principalId)) {
            throw new AccessDeniedException("Competitor scraping blocked.");
        }

        if (isDriver
                && load.getStatus() != Load.LoadStatus.AVAILABLE
                && !bookingRepository.existsByLoadIdAndDriverIdAndStatusIn(
                        load.getId(),
                        principalId,
                        List.of(
                                Booking.BookingStatus.AWAITING_PAYMENT,
                                Booking.BookingStatus.CONFIRMED,
                                Booking.BookingStatus.IN_TRANSIT,
                                Booking.BookingStatus.COMPLETED
                        ))) {
            throw new AccessDeniedException("Load no longer available.");
        }

        return ResponseEntity.ok(LoadDetailResponse.builder()
                .id(load.getId())
                .originName(load.getOriginName())
                .destinationName(load.getDestinationName())
                .requiredCapacity(load.getRequiredCapacity())
                .payoutInr(load.getPayoutInr())
                .pickupTime(load.getPickupTime())
                .status(load.getStatus().name())
                .createdAt(load.getCreatedAt())
                .build());
    }

    @GetMapping("/loads/my-loads")
    public ResponseEntity<List<LoadDetailResponse>> getMyLoads(
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(loadService.getMyLoads(UUID.fromString(userId)));
    }

    @PostMapping("/bookings")
    public ResponseEntity<BookingResponse> createBooking(
            @Valid @RequestBody BookingRequest request,
            @AuthenticationPrincipal String userId) {
        UUID driverId = UUID.fromString(userId);
        return ResponseEntity.ok(loadService.confirmBooking(request, driverId));
    }

    @PostMapping("/bookings/{bookingId}/no-show")
    public ResponseEntity<Map<String, String>> reportNoShow(@PathVariable UUID bookingId) {
        loadService.reportNoShow(bookingId);
        return ResponseEntity.ok(Map.of("status", "reported",
                "message", "No-show recorded. Driver trust score updated."));
    }

    @GetMapping("/trucks/verify/{registrationNumber}")
    public ResponseEntity<Object> verifyTruck(@PathVariable String registrationNumber) {
        return ResponseEntity.ok(Map.of(
                "registration_number", registrationNumber,
                "verified", loadService.verifyTruckWithUlip(registrationNumber),
                "timestamp", java.time.Instant.now().toString()
        ));
    }

    @GetMapping("/health")
    public ResponseEntity<Object> health() {
        return ResponseEntity.ok(Map.of(
                "service", "vahansync-core",
                "status", "UP",
                "version", "4.0.0"
        ));
    }
}
