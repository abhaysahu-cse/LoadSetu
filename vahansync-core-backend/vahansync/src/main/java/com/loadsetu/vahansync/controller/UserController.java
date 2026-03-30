package com.loadsetu.vahansync.controller;

import com.loadsetu.vahansync.dto.Dtos.DeviceTokenRequest;
import com.loadsetu.vahansync.dto.Dtos.UserProfileResponse;
import com.loadsetu.vahansync.entity.Truck;
import com.loadsetu.vahansync.entity.User;
import com.loadsetu.vahansync.entity.UserDevice;
import jakarta.transaction.Transactional;
import com.loadsetu.vahansync.repository.TruckRepository;
import com.loadsetu.vahansync.repository.UserDeviceRepository;
import com.loadsetu.vahansync.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.time.Instant;
import java.util.UUID;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final TruckRepository truckRepository;
    private final UserDeviceRepository userDeviceRepository;

    @PostMapping("/device-token")
    @Transactional
    public ResponseEntity<Map<String, String>> registerDeviceToken(
            @Valid @RequestBody DeviceTokenRequest request,
            Authentication auth
    ) {
        UUID userId = UUID.fromString(auth.getName());
        userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "User not found"));

        userDeviceRepository.findByFcmToken(request.getFcmToken())
                .ifPresent(existing -> userDeviceRepository.deleteByFcmToken(existing.getFcmToken()));

        UserDevice device = UserDevice.builder()
                .userId(userId)
                .fcmToken(request.getFcmToken())
                .deviceType(request.getDeviceType())
                .lastActive(Instant.now())
                .build();
        userDeviceRepository.save(device);

        return ResponseEntity.ok(Map.of("status", "Device Registered"));
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> me(@AuthenticationPrincipal String userId) {
        User user = userRepository.findById(UUID.fromString(userId))
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "User not found"));

        Truck truck = truckRepository.findFirstByOwnerId(user.getId()).orElse(null);

        return ResponseEntity.ok(UserProfileResponse.builder()
                .userId(user.getId())
                .phone(user.getPhone())
                .name(user.getFullName())
                .role(user.getRole().name())
                .companyName(user.getCompanyName())
                .truckId(truck != null ? truck.getId() : null)
                .truckNumber(truck != null ? truck.getTruckNumber() : null)
                .truckType(truck != null ? truck.getStatus().name() : null)
                .currentStatus(truck != null ? truck.getStatus().name() : "OFFLINE")
                .createdAt(user.getCreatedAt())
                .build());
    }
}
