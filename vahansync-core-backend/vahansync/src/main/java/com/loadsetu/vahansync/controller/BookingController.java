package com.loadsetu.vahansync.controller;

import com.loadsetu.vahansync.entity.Booking;
import com.loadsetu.vahansync.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@RestController
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingRepository bookingRepository;

    @PatchMapping("/{id}/status")
    public ResponseEntity<Map<String, String>> updateStatus(
            @PathVariable UUID id,
            @RequestParam String status,
            Authentication authentication) {

        boolean isDriver = authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_DRIVER".equals(a.getAuthority()));
        if (!isDriver) {
            throw new ResponseStatusException(FORBIDDEN, "Driver role required");
        }

        UUID userId = UUID.fromString(authentication.getName());
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Booking not found"));

        if (booking.getDriverId() == null || !booking.getDriverId().equals(userId)) {
            throw new ResponseStatusException(FORBIDDEN, "Booking does not belong to this driver");
        }

        Booking.BookingStatus nextStatus;
        try {
            nextStatus = Booking.BookingStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid booking status");
        }

        if (booking.getStatus() == Booking.BookingStatus.CONFIRMED
                && nextStatus == Booking.BookingStatus.IN_TRANSIT) {
            booking.setStatus(Booking.BookingStatus.IN_TRANSIT);
        } else if (booking.getStatus() == Booking.BookingStatus.IN_TRANSIT
                && nextStatus == Booking.BookingStatus.COMPLETED) {
            booking.setStatus(Booking.BookingStatus.COMPLETED);
            booking.setCompletedAt(Instant.now());
        } else {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid booking status transition");
        }

        bookingRepository.save(booking);
        return ResponseEntity.ok(Map.of("status", booking.getStatus().name()));
    }
}
