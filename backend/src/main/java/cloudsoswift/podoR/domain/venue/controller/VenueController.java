package cloudsoswift.podoR.domain.venue.controller;

import cloudsoswift.podoR.domain.venue.dto.VenueCreateRequest;
import cloudsoswift.podoR.domain.venue.dto.VenueResponse;
import cloudsoswift.podoR.domain.venue.dto.VenueUpdateRequest;
import cloudsoswift.podoR.domain.venue.service.VenueService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequiredArgsConstructor
@RequestMapping("/venues")
public class VenueController {

    private final VenueService venueService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<VenueResponse>> getList(Pageable pageable) {
        return ResponseEntity.ok(venueService.getList(pageable));
    }

    @GetMapping("/{seq}")
    public ResponseEntity<VenueResponse> getOne(@PathVariable Long seq) {
        return ResponseEntity.ok(venueService.getOne(seq));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VenueResponse> create(@RequestBody VenueCreateRequest request) {
        VenueResponse response = venueService.create(request);
        return ResponseEntity.created(URI.create("/venues/" + response.getSeq())).body(response);
    }

    @PutMapping("/{seq}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VenueResponse> update(@PathVariable Long seq,
                                                @RequestBody VenueUpdateRequest request) {
        return ResponseEntity.ok(venueService.update(seq, request));
    }

    @DeleteMapping("/{seq}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long seq) {
        venueService.delete(seq);
        return ResponseEntity.noContent().build();
    }
}
