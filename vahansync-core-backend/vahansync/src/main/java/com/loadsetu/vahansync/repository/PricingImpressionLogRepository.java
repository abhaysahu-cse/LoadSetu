package com.loadsetu.vahansync.repository;

import com.loadsetu.vahansync.entity.PricingImpressionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface PricingImpressionLogRepository extends JpaRepository<PricingImpressionLog, UUID> {

    /** Acceptance rate per load — used by pricing model feedback loop. */
    long countByLoadIdAndDriverResponse(UUID loadId, PricingImpressionLog.DriverResponse driverResponse);
}
