package com.loadsetu.vahansync.controller;

import com.loadsetu.vahansync.dto.Dtos.*;
import com.loadsetu.vahansync.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Auth controller — V4 final.
 *
 * Endpoints:
 *   POST /api/v1/auth/login               — All users; returns JWT
 *   POST /api/v1/auth/register            — DRIVER / FLEET_OWNER accounts
 *   POST /api/v1/auth/register-shipper    — V4: SHIPPER accounts (requires companyName)
 *
 * All endpoints are PUBLIC (no JWT required) — listed in SecurityConfig permitAll().
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/register-driver")
    public ResponseEntity<AuthResponse> registerDriver(
            @Valid @RequestBody RegisterDriverRequest request) {
        return ResponseEntity.ok(authService.registerDriver(request));
    }

    /**
     * V4: Shipper-specific registration.
     *
     * POST /api/v1/auth/register-shipper
     * Body: { "phone": "+919876543210", "password": "min8chars", "companyName": "Tata Freight Pvt Ltd" }
     *
     * Differences from /register:
     *  - Role is always SHIPPER (not user-supplied)
     *  - companyName is @NotBlank (required, not optional)
     *  - company_name stored in dedicated DB column
     *  - Returned in AuthResponse.company_name for Next.js dashboard header
     */
    @PostMapping("/register-shipper")
    public ResponseEntity<AuthResponse> registerShipper(
            @Valid @RequestBody RegisterShipperRequest request) {
        return ResponseEntity.ok(authService.registerShipper(request));
    }
}
