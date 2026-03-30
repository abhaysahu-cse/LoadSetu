package com.loadsetu.vahansync.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * User entity — V4 final.
 *
 * V4 addition: companyName field for SHIPPER and FLEET_OWNER roles.
 * Null for DRIVER accounts (individual drivers have no company).
 * Stored in the name column for SHIPPER accounts — used on invoices,
 * load listings, and the Next.js dashboard header.
 *
 * All previous fields unchanged.
 */
@Entity
@Table(
    name = "users",
    indexes = {
        @Index(name = "idx_user_phone", columnList = "phone", unique = true),
        @Index(name = "idx_user_role",  columnList = "role")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @NotBlank
    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    /**
     * E.164 format: +919876543210.
     * Unique + indexed — login identity and WhatsApp routing key.
     */
    @NotBlank
    @Column(name = "phone", nullable = false, unique = true, length = 20)
    private String phone;

    /** BCrypt-hashed password. Never store plain text. */
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private UserRole role;

    /**
     * V4 — Company name for SHIPPER and FLEET_OWNER accounts.
     * Null for individual DRIVER accounts.
     * Used on load listings, invoices, and the Next.js dashboard header.
     * Stored in a dedicated column (not overloaded onto fullName) so
     * both the personal name and company name are independently queryable.
     */
    @Column(name = "company_name", length = 200)
    private String companyName;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @CreatedDate
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public enum UserRole {
        DRIVER,       // Individual truck driver; WhatsApp-first
        SHIPPER,      // Enterprise posting loads; dashboard user
        FLEET_OWNER   // Owns multiple trucks; mix of both
    }
}
