package com.loadsetu.vahansync.service;

import com.loadsetu.vahansync.dto.Dtos.*;
import com.loadsetu.vahansync.entity.Truck;
import com.loadsetu.vahansync.entity.User;
import com.loadsetu.vahansync.repository.TruckRepository;
import com.loadsetu.vahansync.repository.UserRepository;
import com.loadsetu.vahansync.security.JwtUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Authentication service — V4 final.
 *
 * V4 additions:
 *  - registerShipper(): dedicated method for SHIPPER accounts that
 *    saves companyName and returns it in the AuthResponse.
 *    companyName is displayed in the Next.js dashboard header and on
 *    load listings visible to drivers.
 *
 * All previous login() and register() methods unchanged.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository  userRepository;
    private final TruckRepository truckRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils        jwtUtils;

    // ─── Login ───────────────────────────────────────────────────────────────

    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Invalid phone or password"));

        if (!user.getIsActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Account is deactivated. Contact support@loadsetu.in");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            log.warn("Failed login attempt for phone={}", request.getPhone());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Invalid phone or password");
        }

        log.info("Login successful: userId={} role={}", user.getId(), user.getRole());

        return buildAuthResponse(user,
                jwtUtils.generateToken(user.getId().toString(), user.getRole().name()));
    }

    // ─── Generic Registration (DRIVER / FLEET_OWNER) ─────────────────────────

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Phone number already registered");
        }

        User user = User.builder()
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .companyName(request.getCompanyName()) // Nullable for DRIVER
                .build();

        User saved = userRepository.save(user);
        log.info("User registered: id={} role={}", saved.getId(), saved.getRole());

        return buildAuthResponse(saved,
                jwtUtils.generateToken(saved.getId().toString(), saved.getRole().name()));
    }

    // ─── V4: Shipper-Specific Registration ───────────────────────────────────

    /**
     * POST /api/v1/auth/register-shipper
     *
     * Dedicated registration endpoint for enterprise shippers.
     * Unlike generic registration:
     *  - Role is hard-coded to SHIPPER (no user-supplied role)
     *  - companyName is REQUIRED (not optional)
     *  - companyName is persisted to users.company_name column
     *  - company_name is returned in the AuthResponse for the
     *    Next.js dashboard to display in the header immediately after login
     *
     * Security note: phone uniqueness check + password encoding
     * are identical to the generic registration flow.
     */
    @Transactional
    public AuthResponse registerShipper(RegisterShipperRequest request) {
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Phone number already registered");
        }

        User user = User.builder()
                .fullName(request.getCompanyName()) // Company name is also the "full name" for shippers
                .phone(request.getPhone())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(User.UserRole.SHIPPER)
                .companyName(request.getCompanyName()) // Dedicated company_name column
                .build();

        User saved = userRepository.save(user);
        log.info("Shipper registered: id={} company={}", saved.getId(), saved.getCompanyName());

        return buildAuthResponse(saved,
                jwtUtils.generateToken(saved.getId().toString(), "SHIPPER"));
    }

    @Transactional
    public AuthResponse registerDriver(RegisterDriverRequest request) {
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Phone number already registered");
        }

        String normalizedTruckNumber = request.getTruckNumber()
                .replaceAll("\\s+", "")
                .toUpperCase();

        if (truckRepository.existsByTruckNumber(normalizedTruckNumber)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Truck number already registered");
        }

        User user = User.builder()
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(User.UserRole.DRIVER)
                .build();

        User savedUser = userRepository.save(user);

        Truck truck = Truck.builder()
                .driverName(request.getFullName())
                .phone(request.getPhone())
                .capacityTons(request.getCapacity())
                .truckNumber(normalizedTruckNumber)
                .ownerId(savedUser.getId())
                .status(Truck.TruckStatus.AVAILABLE)
                .build();
        truckRepository.save(truck);

        log.info("Driver registered: userId={} truckNumber={}", savedUser.getId(), normalizedTruckNumber);

        return buildAuthResponse(savedUser,
                jwtUtils.generateToken(savedUser.getId().toString(), User.UserRole.DRIVER.name()));
    }

    // ─── Helper ──────────────────────────────────────────────────────────────

    private AuthResponse buildAuthResponse(User user, String token) {
        Truck truck = truckRepository.findFirstByOwnerId(user.getId()).orElse(null);

        return AuthResponse.builder()
                .token(token)
                .expiresIn(86400000L)
                .userId(user.getId())
                .role(user.getRole().name())
                .fullName(user.getFullName())
                .truckId(truck != null ? truck.getId() : null)
                .companyName(user.getCompanyName()) // Null for DRIVER accounts
                .build();
    }
}
