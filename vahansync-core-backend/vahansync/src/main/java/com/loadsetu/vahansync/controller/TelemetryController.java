package com.loadsetu.vahansync.controller;

import com.loadsetu.vahansync.dto.Dtos.TruckTelemetryEvent;
import com.loadsetu.vahansync.kafka.KafkaProducerService;
import com.loadsetu.vahansync.repository.TruckRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * GPS Telemetry API — Module 1 endpoint map.
 *
 * POST /api/v1/telemetry   — JWT-authenticated, driver pushes GPS location.
 *                            Publishes to Kafka truck-telemetry-events topic.
 *                            KafkaProducerService consumer updates PG + Redis.
 *
 * POST /api/v1/telemetry/twilio — PUBLIC. Receives WhatsApp webhook from
 *                                 Meta/Twilio (no JWT, IP allow-listing in prod).
 */
@RestController
@RequestMapping("/api/v1/telemetry")
@RequiredArgsConstructor
@Slf4j
public class TelemetryController {

    private final KafkaProducerService kafkaProducerService;
    private final TruckRepository      truckRepository;

    /**
     * Driver mobile SDK pushes GPS location every 30 seconds.
     * JWT subject = userId (truck owner). We look up their truckId.
     *
     * Publishes to Kafka 'truck-telemetry-events' — consumer in
     * KafkaProducerService updates both PostgreSQL and Redis.
     */
    @PostMapping
    public ResponseEntity<Map<String, String>> pushTelemetry(
            @Valid @RequestBody TruckTelemetryEvent event,
            @AuthenticationPrincipal String principalId) {

        // Ensure driver only publishes telemetry for their own truck
        UUID ownerId = UUID.fromString(principalId);
        boolean isOwner = truckRepository.existsByIdAndOwnerId(event.getTruckId(), ownerId);
        if (!isOwner) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "You do not own this truck"
            ));
        }

        // Stamp server-side timestamp if client didn't provide one
        if (event.getTimestamp() == null) {
            event.setTimestamp(Instant.now());
        }

        kafkaProducerService.publishTelemetryEvent(event);
        log.debug("Telemetry published: truck={} lat={} lng={}",
                event.getTruckId(), event.getLat(), event.getLng());

        return ResponseEntity.ok(Map.of("status", "received"));
    }

    /**
     * PUBLIC endpoint — receives WhatsApp message webhook from Meta/Twilio.
     * Forwards raw payload to Python FastAPI via Kafka or direct HTTP.
     * In prod: verify Twilio signature header before processing.
     */
    @PostMapping("/twilio")
    public ResponseEntity<String> twilioWebhook(@RequestBody String rawBody) {
        log.info("WhatsApp webhook received: {} chars", rawBody.length());
        // TODO: Validate Twilio signature, forward to Python AI FastAPI service
        return ResponseEntity.ok("<?xml version='1.0'?><Response></Response>");
    }
}
