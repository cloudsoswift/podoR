package cloudsoswift.podoR.domain.concerthall.controller;

import cloudsoswift.podoR.domain.concerthall.dto.ConcertHallCreateRequest;
import cloudsoswift.podoR.domain.concerthall.dto.ConcertHallResponse;
import cloudsoswift.podoR.domain.concerthall.dto.ConcertHallUpdateRequest;
import cloudsoswift.podoR.domain.concerthall.service.ConcertHallService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequiredArgsConstructor
@RequestMapping("/concert-halls")
public class ConcertHallController {

    private final ConcertHallService concertHallService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<ConcertHallResponse>> getList(Pageable pageable) {
        return ResponseEntity.ok(concertHallService.getList(pageable));
    }

    @GetMapping("/{seq}")
    public ResponseEntity<ConcertHallResponse> getOne(@PathVariable Long seq) {
        return ResponseEntity.ok(concertHallService.getOne(seq));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ConcertHallResponse> create(@RequestBody ConcertHallCreateRequest request) {
        ConcertHallResponse response = concertHallService.create(request);
        return ResponseEntity.created(URI.create("/concert-halls/" + response.getSeq())).body(response);
    }

    @PutMapping("/{seq}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ConcertHallResponse> update(@PathVariable Long seq,
                                                      @RequestBody ConcertHallUpdateRequest request) {
        return ResponseEntity.ok(concertHallService.update(seq, request));
    }

    @DeleteMapping("/{seq}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long seq) {
        concertHallService.delete(seq);
        return ResponseEntity.noContent().build();
    }
}
