package com.loadsetu.vahansync.kafka;

import com.loadsetu.vahansync.dto.Dtos.BookingEvent;
import com.loadsetu.vahansync.dto.Dtos.TruckTelemetryEvent;
import com.loadsetu.vahansync.repository.TruckRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

/**
 * Kafka producer + telemetry consumer — V3.
 *
 * V3 change: publishTelemetryEvent() exposed as public method
 * so TelemetryController can call it directly for REST-pushed GPS data.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KafkaProducerService {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final TruckRepository truckRepository;

    @Value("${kafka.topics.booking-events:booking-events}")
    private String bookingEventsTopic;

    @Value("${kafka.topics.load-status-events:load-status-events}")
    private String loadStatusEventsTopic;

    @Value("${kafka.topics.truck-telemetry-events:truck-telemetry-events}")
    private String truckTelemetryTopic;

    // ─── PRODUCER: booking-events ─────────────────────────────────────────────

    public void publishBookingEvent(BookingEvent event) {
        String key = event.getBookingId().toString();
        kafkaTemplate.send(bookingEventsTopic, key, event)
                .whenComplete((result, ex) -> {
                    if (ex != null) log.error("Kafka publish failed [booking-events] key={}: {}", key, ex.getMessage());
                    else log.info("Kafka published [booking-events] partition={} offset={} key={}",
                            result.getRecordMetadata().partition(),
                            result.getRecordMetadata().offset(), key);
                });
    }

    // ─── PRODUCER: load-status-events ────────────────────────────────────────

    public void publishLoadStatusEvent(UUID loadId, String newStatus) {
        var payload = Map.of(
                "event_type", "LOAD_STATUS_CHANGED",
                "load_id",    loadId.toString(),
                "new_status", newStatus,
                "timestamp",  java.time.Instant.now().toString()
        );
        kafkaTemplate.send(loadStatusEventsTopic, loadId.toString(), payload)
                .whenComplete((result, ex) -> {
                    if (ex != null) log.error("Kafka publish failed [load-status-events]: {}", ex.getMessage());
                });
    }

    // ─── PRODUCER: truck-telemetry-events (called by TelemetryController) ────

    public void publishTelemetryEvent(TruckTelemetryEvent event) {
        kafkaTemplate.send(truckTelemetryTopic, event.getTruckId().toString(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) log.error("Kafka publish failed [truck-telemetry-events]: {}", ex.getMessage());
                });
    }

    // ─── CONSUMER: truck-telemetry-events ────────────────────────────────────

    @KafkaListener(
        topics   = "${kafka.topics.truck-telemetry-events:truck-telemetry-events}",
        groupId  = "vahansync-telemetry-consumer",
        containerFactory = "kafkaListenerContainerFactory"
    )
    public void consumeTruckTelemetry(TruckTelemetryEvent event) {
        if (event.getTruckId() == null || event.getLat() == null || event.getLng() == null) {
            log.warn("Malformed telemetry event dropped: {}", event);
            return;
        }

        int updated = truckRepository.updateLocation(
                event.getTruckId(), event.getLat(), event.getLng());

        if (updated == 0) {
            log.warn("Telemetry for unknown truck: {}", event.getTruckId());
        }
        // TODO: write to Redis sorted set for real-time dashboard
    }
}
