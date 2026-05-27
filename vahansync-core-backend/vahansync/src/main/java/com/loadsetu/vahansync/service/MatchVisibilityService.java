package com.loadsetu.vahansync.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.loadsetu.vahansync.dto.Dtos;
import com.loadsetu.vahansync.entity.Load;
import com.loadsetu.vahansync.repository.LoadRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class MatchVisibilityService {

    private final ObjectMapper objectMapper;
    private final LoadRepository loadRepository;

    private final Map<UUID, CachedLoadMatches> matchesCache = new ConcurrentHashMap<>();

    @KafkaListener(
            topics = "load-matches",
            groupId = "vahansync-match-visibility-group",
            autoStartup = "true",
            containerFactory = "stringKafkaListenerContainerFactory"
    )
    public void consumeMatches(String payload) {
        try {
            LoadMatchesPayload message = objectMapper.readValue(normalizePayload(payload), LoadMatchesPayload.class);
            if (message.loadId() == null) {
                return;
            }

            matchesCache.put(
                    UUID.fromString(message.loadId()),
                    new CachedLoadMatches(
                            UUID.fromString(message.loadId()),
                            message.matches() != null ? message.matches() : List.of(),
                            message.processedAt() != null ? message.processedAt() : Instant.now()
                    )
            );
        } catch (Exception ex) {
            log.warn("Failed to consume load-matches payload: {}", ex.getMessage());
        }
    }

    private String normalizePayload(String payload) throws Exception {
        if (payload == null) {
            return "{}";
        }

        String trimmed = payload.trim();
        if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
            return objectMapper.readValue(trimmed, String.class);
        }
        return trimmed;
    }

    public Dtos.LoadMatchesResponse getMatchesForLoad(UUID loadId, UUID requesterId, boolean isAdmin) {
        Load load = isAdmin
                ? loadRepository.findById(loadId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Load not found"))
                : loadRepository.findByIdAndShipperId(loadId, requesterId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Load not found"));

        CachedLoadMatches cached = matchesCache.get(load.getId());
        return Dtos.LoadMatchesResponse.builder()
                .loadId(load.getId())
                .matches(cached != null ? cached.matches() : List.of())
                .build();
    }

    private record CachedLoadMatches(
            UUID loadId,
            List<Dtos.MatchCandidate> matches,
            Instant processedAt
    ) {}

    private record LoadMatchesPayload(
            @JsonProperty("loadId") String loadId,
            @JsonProperty("matches") List<Dtos.MatchCandidate> matches,
            @JsonProperty("processedAt") Instant processedAt
    ) {}
}
