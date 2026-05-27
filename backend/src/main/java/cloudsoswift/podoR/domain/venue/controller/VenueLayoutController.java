package cloudsoswift.podoR.domain.venue.controller;

import cloudsoswift.podoR.domain.venue.dto.VenueLayoutRequest;
import cloudsoswift.podoR.domain.venue.dto.VenueLayoutResponse;
import cloudsoswift.podoR.domain.venue.service.VenueLayoutService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequiredArgsConstructor
@RequestMapping("/venues/{venueSeq}/layout")
public class VenueLayoutController {

    private final VenueLayoutService venueLayoutService;

    @GetMapping
    public ResponseEntity<VenueLayoutResponse> getOne(@PathVariable Long venueSeq) {
        return ResponseEntity.ok(venueLayoutService.getOne(venueSeq));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VenueLayoutResponse> create(@PathVariable Long venueSeq,
                                                      @RequestBody VenueLayoutRequest request) {
        VenueLayoutResponse response = venueLayoutService.create(venueSeq, request);
        return ResponseEntity.created(URI.create("/venues/" + venueSeq + "/layout")).body(response);
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VenueLayoutResponse> update(@PathVariable Long venueSeq,
                                                      @RequestBody VenueLayoutRequest request) {
        return ResponseEntity.ok(venueLayoutService.update(venueSeq, request));
    }

    @DeleteMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long venueSeq) {
        venueLayoutService.delete(venueSeq);
        return ResponseEntity.noContent().build();
    }
}
