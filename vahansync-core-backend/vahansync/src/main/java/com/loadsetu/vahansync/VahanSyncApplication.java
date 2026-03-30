package com.loadsetu.vahansync;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

/**
 * VahanSync Core Engine — V3 Production Hardened.
 *
 * @EnableJpaAuditing: Powers @CreatedDate / @LastModifiedDate on all entities.
 *   Requires AuditingEntityListener on each entity class.
 *
 * @PostConstruct UTC: Forces JVM timezone to UTC before any bean
 *   initialization touches timestamps. Prevents IST/UTC drift between
 *   Spring Boot (Indian servers default to IST) and Python AI layer.
 */
@SpringBootApplication
@EnableKafka
@EnableAsync
@EnableScheduling
@EnableJpaAuditing
public class VahanSyncApplication {

    @PostConstruct
    void started() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    }

    public static void main(String[] args) {
        SpringApplication.run(VahanSyncApplication.class, args);
    }
}
