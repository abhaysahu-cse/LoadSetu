package com.loadsetu.vahansync.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_devices")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserDevice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "fcm_token", nullable = false, unique = true, length = 255)
    private String fcmToken;

    @Column(name = "device_type", length = 50)
    private String deviceType;

    @Column(name = "last_active", nullable = false)
    private Instant lastActive;
}
