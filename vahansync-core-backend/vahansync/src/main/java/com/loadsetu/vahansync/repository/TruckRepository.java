package com.loadsetu.vahansync.repository;

import com.loadsetu.vahansync.entity.Truck;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface TruckRepository extends JpaRepository<Truck, UUID> {

    Optional<Truck> findByPhone(String phone);

    boolean existsByTruckNumber(String truckNumber);

    Optional<Truck> findFirstByOwnerId(UUID ownerId);

    /** IDOR-safe ownership check for telemetry endpoint. */
    boolean existsByIdAndOwnerId(UUID id, UUID ownerId);

    /**
     * Hot path: Kafka telemetry consumer calls this on every GPS ping.
     * Direct native update avoids full entity load — critical for throughput.
     */
    @Modifying
    @Transactional
    @Query(value = """
            UPDATE trucks
            SET current_location = ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),
                updated_at        = NOW()
            WHERE id = :truckId
            """, nativeQuery = true)
    int updateLocation(
            @Param("truckId") UUID truckId,
            @Param("lat") double lat,
            @Param("lng") double lng
    );
}
