package com.loadsetu.vahansync.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.loadsetu.vahansync.dto.Dtos.*;
import com.loadsetu.vahansync.entity.*;
import com.loadsetu.vahansync.kafka.KafkaProducerService;
import com.loadsetu.vahansync.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/**
 * Load service — V4 final.
 *
 * V4 addition: createSingleLoad()
 *   - Called by the Next.js dashboard when a shipper posts a new load
 *   - Converts lat/lng Double values to PostGIS geometry(Point,4326) using
 *     JTS GeometryFactory (available via hibernate-spatial transitive dep)
 *   - IMPORTANT: PostGIS/WGS84 convention is Coordinate(LONGITUDE, LATITUDE)
 *     i.e. X=lng, Y=lat — counter-intuitive but required for correct geometry
 *   - shipperId comes from the authenticated JWT principal (never from request body)
 *
 * All previous V2/V3 methods unchanged.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LoadService {

    private final LoadRepository              loadRepository;
    private final TruckRepository             truckRepository;
    private final BookingRepository           bookingRepository;
    private final UserRepository              userRepository;
    private final OutboxEventRepository       outboxRepository;
    private final KafkaProducerService        kafkaProducerService;
    private final UlipVerificationService     ulipVerificationService;
    private final ReservationService          reservationService;
    private final PricingImpressionLogRepository impressionLogRepository;
    private final ObjectMapper                objectMapper;

    /**
     * JTS GeometryFactory configured for SRID 4326 (WGS84 — same as GPS coordinates).
     * Shared instance — GeometryFactory is thread-safe.
     */
    private static final GeometryFactory GEOMETRY_FACTORY =
            new GeometryFactory(new PrecisionModel(), 4326);

    @Value("${loadsetu.matching.radius-km:50}")
    private double radiusKm;

    @Value("${loadsetu.matching.shadow-ban.hard-block-threshold:5}")
    private int hardBlockThreshold;

    @Value("${kafka.topics.booking-events:booking-events}")
    private String bookingEventsTopic;

    @Value("${kafka.topics.load-events:load-events}")
    private String loadEventsTopic;

    // ─────────────────────────────────────────────────────────────────────────
    //  V4: SINGLE LOAD CREATION (Next.js Dashboard)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Creates a single load posted by an authenticated shipper.
     *
     * The key responsibility of this method is the PostGIS geometry conversion:
     *
     *   WGS84 / PostGIS convention: Coordinate(longitude, latitude)
     *   i.e. X = longitude (east-west), Y = latitude (north-south)
     *
     * This is counter-intuitive (we say "lat/lng" but PostGIS stores lng/lat).
     * Getting this wrong causes spatial queries to return incorrect results.
     *
     * GeometryFactory is configured with SRID=4326 — matches the GIST index
     * on loads.origin_geom so ST_DWithin queries use the index correctly.
     *
     * @param req       Validated DTO from Next.js dashboard (lat/lng as Doubles)
     * @param shipperId UUID from authenticated JWT principal — never from request body
     * @return          CreateLoadResponse with new loadId for the frontend
     */
    @Transactional
    public CreateLoadResponse createSingleLoad(CreateLoadRequest req, UUID shipperId) {

        // Convert lat/lng to PostGIS Points — NOTE: Coordinate(lng, lat) not (lat, lng)
        Point originPoint = GEOMETRY_FACTORY.createPoint(
                new Coordinate(req.getOriginLng(), req.getOriginLat())
        );
        Point destinationPoint = GEOMETRY_FACTORY.createPoint(
                new Coordinate(req.getDestLng(), req.getDestLat())
        );

        Load load = Load.builder()
                .shipperId(shipperId)
                .originName(req.getOriginName())
                .originGeom(originPoint)
                .destinationName(req.getDestinationName())
                .destinationGeom(destinationPoint)
                .requiredCapacity(req.getRequiredCapacity())
                .payoutInr(req.getPayoutInr())
                .pickupTime(req.getPickupTime())
                .postedAt(Instant.now())
                .status(Load.LoadStatus.AVAILABLE)
                .build();

        Load saved = loadRepository.save(load);
        log.info("[LOAD CREATED] loadId={} origin={} dest={} shipper={}",
                saved.getId(), saved.getOriginName(), saved.getDestinationName(), shipperId);

        writeLoadCreatedToOutbox(saved);

        return CreateLoadResponse.builder()
                .loadId(saved.getId())
                .originName(saved.getOriginName())
                .destinationName(saved.getDestinationName())
                .status(saved.getStatus().name())
                .createdAt(saved.getCreatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public List<NearbyLoadResponse> getNearbyLoads(double lat, double lng, double radiusKm) {
        List<Object[]> rawResults = loadRepository.findLoadsWithDeadheadKm(
                lat,
                lng,
                100.0,
                radiusKm * 1000.0
        );

        return rawResults.stream()
                .map(row -> {
                    UUID shipperId = parseUuid(row[10]);
                    String shipperName = userRepository.findById(shipperId)
                            .map(u -> u.getCompanyName() != null ? u.getCompanyName() : u.getFullName())
                            .orElse("LoadSetu Shipper");
                    return NearbyLoadResponse.builder()
                            .id(parseUuid(row[0]))
                            .originName(String.valueOf(row[1]))
                            .originLat(((org.locationtech.jts.geom.Point) row[2]).getY())
                            .originLng(((org.locationtech.jts.geom.Point) row[2]).getX())
                            .destinationName(String.valueOf(row[3]))
                            .destinationLat(((org.locationtech.jts.geom.Point) row[4]).getY())
                            .destinationLng(((org.locationtech.jts.geom.Point) row[4]).getX())
                            .requiredCapacity(parseDouble(row[5]))
                            .payoutInr(parseBigDecimal(row[6]))
                            .pickupTime((Instant) row[7])
                            .status(String.valueOf(row[9]))
                            .shipperName(shipperName)
                            .distanceKm(parseDouble(row[12]))
                            .build();
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public InternalLoadSearchResponse searchLoadsForMl(InternalLoadSearchRequest request) {
        double minCapacity = request.getMinCapacityTons() != null
                ? request.getMinCapacityTons()
                : 0.0;
        Instant availableBefore = request.getAvailableBefore() != null
                ? request.getAvailableBefore()
                : Instant.now().plusSeconds(7 * 24 * 3600);

        List<InternalLoadRecord> loads = loadRepository.findAll().stream()
                .filter(load -> load.getStatus() == Load.LoadStatus.AVAILABLE)
                .filter(load -> load.getRequiredCapacity() >= minCapacity)
                .filter(load -> !load.getPickupTime().isAfter(availableBefore))
                .sorted(Comparator.comparing(Load::getPickupTime))
                .limit(request.getLimit() != null ? request.getLimit() : 50)
                .map(load -> {
                    String shipperName = userRepository.findById(load.getShipperId())
                            .map(u -> u.getCompanyName() != null ? u.getCompanyName() : u.getFullName())
                            .orElse("LoadSetu Shipper");
                    return InternalLoadRecord.builder()
                            .loadId(load.getId())
                            .shipperId(load.getShipperId())
                            .shipperName(shipperName)
                            .origin(load.getOriginName())
                            .originLat(load.getOriginGeom().getY())
                            .originLng(load.getOriginGeom().getX())
                            .originH3Index("unavailable")
                            .destination(load.getDestinationName())
                            .destinationLat(load.getDestinationGeom().getY())
                            .destinationLng(load.getDestinationGeom().getX())
                            .weightTons(load.getRequiredCapacity())
                            .loadType("general")
                            .basePriceInr(load.getPayoutInr())
                            .status("posted")
                            .timeWindowStart(load.getPickupTime())
                            .timeWindowEnd(load.getPickupTime().plusSeconds(24 * 3600))
                            .build();
                })
                .toList();

        return InternalLoadSearchResponse.builder().loads(loads).build();
    }

    @Transactional(readOnly = true)
    public List<LoadDetailResponse> getMyLoads(UUID shipperId) {
        return loadRepository.findByShipperIdOrderByCreatedAtDesc(shipperId).stream()
                .map(load -> LoadDetailResponse.builder()
                        .id(load.getId())
                        .originName(load.getOriginName())
                        .destinationName(load.getDestinationName())
                        .requiredCapacity(load.getRequiredCapacity())
                        .payoutInr(load.getPayoutInr())
                        .pickupTime(load.getPickupTime())
                        .status(load.getStatus().name())
                        .createdAt(load.getCreatedAt())
                        .build())
                .toList();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  LOAD MATCHING (unchanged from V3)
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public MatchResponse matchLoads(MatchRequest request) {
        log.info("Match request: truck={} lat={} lng={} capacity={}t",
                request.getTruckId(), request.getCurrentLocationLat(),
                request.getCurrentLocationLng(), request.getCapacityTons());

        Truck truck = truckRepository.findById(request.getTruckId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Truck not found: " + request.getTruckId()));

        if (truck.getNoShowCount() >= hardBlockThreshold) {
            log.warn("Match blocked — shadow-banned truck={}", request.getTruckId());
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Account restricted. Contact support@loadsetu.in");
        }

        List<Object[]> rawResults = loadRepository.findLoadsWithDeadheadKm(
                request.getCurrentLocationLat(),
                request.getCurrentLocationLng(),
                request.getCapacityTons(),
                radiusKm * 1000.0
        );

        List<MatchCandidate> candidates = rawResults.stream()
                .map(row -> mapRowToCandidate(row, truck))
                .toList();

        log.info("Match result: {} candidates for truck={}", candidates.size(), request.getTruckId());
        return MatchResponse.builder().matches(candidates).build();
    }

    private MatchCandidate mapRowToCandidate(Object[] row, Truck truck) {
        double score = reservationService.isDeprioritized(truck.getNoShowCount()) ? 0.5 : 1.0;
        return MatchCandidate.builder()
                .loadId(parseUuid(row[0]))
                .origin(String.valueOf(row[1]))
                .destination(String.valueOf(row[3]))
                .payoutInr(parseBigDecimal(row[6]))
                .deadheadKm(parseDouble(row[12]))
                .confidenceScore(score)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  BOOKING CONFIRMATION (V4: stores driverId)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * V4 change: accepts driverId (authenticated user UUID) and stores it
     * on the Booking entity. This enables the PaymentController to verify
     * that the driver initiating payment owns the booking (IDOR prevention).
     */
    @Transactional
    public BookingResponse confirmBooking(BookingRequest request, UUID driverId) {
        log.info("Booking: truck={} load={} driver={}", request.getTruckId(), request.getLoadId(), driverId);

        if (request.getSourceMessageId() != null) {
            Optional<Booking> existing = bookingRepository
                    .findBySourceMessageId(request.getSourceMessageId());
            if (existing.isPresent()) {
                log.info("Duplicate booking (idempotent): {}", existing.get().getId());
                return toBookingResponse(existing.get(), "Booking already confirmed (idempotent)");
            }
        }

        reservationService.acquireLockOrThrow(request.getTruckId(), request.getLoadId());

        boolean truckBusy = bookingRepository.existsByTruckIdAndStatusIn(
                request.getTruckId(),
                List.of(Booking.BookingStatus.AWAITING_PAYMENT,
                        Booking.BookingStatus.CONFIRMED,
                        Booking.BookingStatus.IN_TRANSIT)
        );
        if (truckBusy) {
            reservationService.releaseLock(request.getLoadId());
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Truck already has an active booking.");
        }

        int updated = loadRepository.markAsBooked(request.getLoadId());
        if (updated == 0) {
            reservationService.releaseLock(request.getLoadId());
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Load is no longer AVAILABLE.");
        }

        Load load = loadRepository.findById(request.getLoadId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Load not found"));

        Booking booking = Booking.builder()
                .truckId(request.getTruckId())
                .loadId(request.getLoadId())
                .driverId(driverId)                         // V4: store authenticated driver
                .agreedPayout(request.getAgreedPayout())
                .deadheadKm(request.getDeadheadKm())
                .confidenceScore(request.getConfidenceScore())
                .originalPayoutInr(load.getPayoutInr())
                .driverMatchFee(request.getDriverMatchFee() != null
                        ? request.getDriverMatchFee()
                        : computeDefaultDriverMatchFee(request.getAgreedPayout()))
                .sourceMessageId(request.getSourceMessageId())
                .status(Booking.BookingStatus.AWAITING_PAYMENT)
                .build();

        Booking saved = bookingRepository.save(booking);
        log.info("Booking created (AWAITING_PAYMENT): id={}", saved.getId());

        writeBookingToOutbox(saved, load);

        return toBookingResponse(saved, "Booking created. Awaiting payment confirmation.");
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  NO-SHOW REPORTING (unchanged from V3)
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public void reportNoShow(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Booking not found: " + bookingId));

        booking.setStatus(Booking.BookingStatus.DRIVER_NO_SHOW);
        bookingRepository.save(booking);

        Truck truck = truckRepository.findById(booking.getTruckId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Truck not found"));

        int newCount = truck.getNoShowCount() + 1;
        truck.setNoShowCount(newCount);
        if (newCount >= hardBlockThreshold) {
            truck.setStatus(Truck.TruckStatus.SHADOW_BANNED);
            log.warn("SHADOW BAN APPLIED: truck={} noShowCount={}", truck.getId(), newCount);
        }
        truckRepository.save(truck);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  BULK LOAD INGESTION (unchanged from V3)
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public BulkLoadResponse bulkIngestLoads(BulkLoadRequest request) {
        int accepted = 0, duplicates = 0, rejected = 0;
        for (LoadItemDto item : request.getLoads()) {
            try {
                String hash = generateLoadHash(item.getShipperId(), item.getOriginCity(),
                        item.getDestinationCity(), item.getPickupDate());
                if (loadRepository.existsByLoadHash(hash)) { duplicates++; continue; }
                int rows = loadRepository.insertWithHash(
                        item.getOriginCity(), item.getOriginLat(), item.getOriginLng(),
                        item.getDestinationCity(), item.getDestinationLat(), item.getDestinationLng(),
                        item.getRequiredCapacity(), item.getPayoutInr(),
                        item.getPickupTime(), item.getShipperId(), hash);
                if (rows > 0) accepted++; else duplicates++;
            } catch (Exception ex) {
                log.error("Bulk ingest rejected: origin={} error={}", item.getOriginCity(), ex.getMessage());
                rejected++;
            }
        }
        log.info("Bulk ingest: accepted={} duplicates={} rejected={}", accepted, duplicates, rejected);
        return BulkLoadResponse.builder()
                .totalReceived(request.getLoads().size())
                .accepted(accepted).duplicatesSkipped(duplicates).rejected(rejected).build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  OUTBOX WRITE (unchanged from V3)
    // ─────────────────────────────────────────────────────────────────────────

    private void writeBookingToOutbox(Booking booking, Load load) {
        try {
            BookingEvent event = BookingEvent.builder()
                    .bookingId(booking.getId()).truckId(booking.getTruckId())
                    .loadId(booking.getLoadId()).origin(load.getOriginName())
                    .destination(load.getDestinationName()).agreedPayoutInr(booking.getAgreedPayout())
                    .deadheadKm(booking.getDeadheadKm()).confidenceScore(booking.getConfidenceScore())
                    .timestamp(Instant.now()).build();

            OutboxEvent outbox = OutboxEvent.builder()
                    .aggregateType("Booking").aggregateId(booking.getId())
                    .topic(bookingEventsTopic).messageKey(booking.getId().toString())
                    .payload(objectMapper.writeValueAsString(event))
                    .status(OutboxEvent.OutboxStatus.PENDING).retryCount(0).build();

            outboxRepository.save(outbox);
        } catch (Exception ex) {
            log.error("Outbox write failed for booking={}: {}", booking.getId(), ex.getMessage());
        }
    }

    private void writeLoadCreatedToOutbox(Load load) {
        try {
            LoadEvent event = LoadEvent.builder()
                    .loadId(load.getId())
                    .pickupLat(load.getOriginGeom().getY())
                    .pickupLng(load.getOriginGeom().getX())
                    .build();

            OutboxEvent outbox = OutboxEvent.builder()
                    .aggregateType("Load")
                    .aggregateId(load.getId())
                    .topic(loadEventsTopic)
                    .messageKey(load.getId().toString())
                    .payload(objectMapper.writeValueAsString(event))
                    .status(OutboxEvent.OutboxStatus.PENDING)
                    .retryCount(0)
                    .build();

            outboxRepository.save(outbox);
        } catch (Exception ex) {
            log.error("Outbox write failed for load={}: {}", load.getId(), ex.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    public boolean verifyTruckWithUlip(String registrationNumber) {
        return ulipVerificationService.verifyTruckRc(registrationNumber);
    }

    private String generateLoadHash(UUID shipperId, String origin, String dest, String date) {
        String raw = shipperId + "|" + origin.toLowerCase().trim()
                   + "|" + dest.toLowerCase().trim() + "|" + date;
        return Integer.toHexString(raw.hashCode());
    }

    private BookingResponse toBookingResponse(Booking b, String message) {
        return BookingResponse.builder().bookingId(b.getId()).status(b.getStatus().name())
                .createdAt(b.getCreatedAt()).message(message).build();
    }

    private BigDecimal computeDefaultDriverMatchFee(BigDecimal agreedPayout) {
        if (agreedPayout == null) {
            return BigDecimal.valueOf(99);
        }
        if (agreedPayout.compareTo(BigDecimal.valueOf(10_000)) < 0) {
            return BigDecimal.valueOf(99);
        }
        if (agreedPayout.compareTo(BigDecimal.valueOf(25_000)) <= 0) {
            return BigDecimal.valueOf(199);
        }
        return BigDecimal.valueOf(299);
    }

    private UUID       parseUuid(Object o)      { return o instanceof UUID u ? u : UUID.fromString(String.valueOf(o)); }
    private BigDecimal parseBigDecimal(Object o) { return o instanceof BigDecimal b ? b : o instanceof Number n ? BigDecimal.valueOf(n.doubleValue()) : new BigDecimal(String.valueOf(o)); }
    private Double     parseDouble(Object o)     { return o instanceof Double d ? d : o instanceof Number n ? n.doubleValue() : Double.parseDouble(String.valueOf(o)); }
}
