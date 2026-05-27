package com.loadsetu.vahansync.controller;

import com.loadsetu.vahansync.dto.Dtos;
import com.loadsetu.vahansync.service.MatchVisibilityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

import static org.springframework.http.HttpStatus.FORBIDDEN;

@RestController
@RequestMapping("/api/v1/matches")
@RequiredArgsConstructor
public class MatchController {

    private final MatchVisibilityService matchVisibilityService;

    @GetMapping("/{loadId}")
    public ResponseEntity<Dtos.LoadMatchesResponse> getMatches(
            @PathVariable UUID loadId,
            Authentication authentication
    ) {
        boolean isShipper = authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_SHIPPER".equals(a.getAuthority()));
        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));

        if (!isShipper && !isAdmin) {
            throw new ResponseStatusException(FORBIDDEN, "Shipper role required");
        }

        UUID requesterId = UUID.fromString(authentication.getName());
        return ResponseEntity.ok(
                matchVisibilityService.getMatchesForLoad(loadId, requesterId, isAdmin)
        );
    }
}
