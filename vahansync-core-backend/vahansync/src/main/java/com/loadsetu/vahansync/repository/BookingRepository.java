package com.loadsetu.vahansync.repository;

import com.loadsetu.vahansync.entity.Booking;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BookingRepository extends JpaRepository<Booking, UUID> {

    List<Booking> findByTruckIdOrderByCreatedAtDesc(UUID truckId);

    List<Booking> findByLoadId(UUID loadId);

    /** IDOR-safe: find booking only if the driverId matches the authenticated user. */
    Optional<Booking> findByIdAndDriverId(UUID id, UUID driverId);

    /** Idempotency guard — prevents duplicate WhatsApp-triggered bookings. */
    Optional<Booking> findBySourceMessageId(String sourceMessageId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Booking b WHERE b.id = :id")
    @QueryHints({
            @QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000")
    })
    Optional<Booking> findByIdForUpdate(@Param("id") UUID id);

    boolean existsByTruckIdAndStatusIn(UUID truckId, List<Booking.BookingStatus> activeStatuses);

    boolean existsByLoadIdAndDriverIdAndStatusIn(
            UUID loadId,
            UUID driverId,
            List<Booking.BookingStatus> statuses
    );

    /** Driver history endpoint. */
    List<Booking> findByDriverIdOrderByCreatedAtDesc(UUID driverId);
}
