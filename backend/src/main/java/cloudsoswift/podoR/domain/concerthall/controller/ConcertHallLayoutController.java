package cloudsoswift.podoR.domain.concerthall.controller;

import cloudsoswift.podoR.domain.concerthall.dto.ConcertHallLayoutRequest;
import cloudsoswift.podoR.domain.concerthall.dto.ConcertHallLayoutResponse;
import cloudsoswift.podoR.domain.concerthall.service.ConcertHallLayoutService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequiredArgsConstructor
@RequestMapping("/concert-halls/{hallSeq}/layout")
public class ConcertHallLayoutController {

    private final ConcertHallLayoutService concertHallLayoutService;

    @GetMapping
    public ResponseEntity<ConcertHallLayoutResponse> getLayout(@PathVariable Long hallSeq) {
        return ResponseEntity.ok(concertHallLayoutService.getOne(hallSeq));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ConcertHallLayoutResponse> create(@PathVariable Long hallSeq,
                                                            @RequestBody ConcertHallLayoutRequest request) {
        ConcertHallLayoutResponse response = concertHallLayoutService.create(hallSeq, request);
        return ResponseEntity.created(URI.create("/concert-halls/" + hallSeq + "/layout")).body(response);
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ConcertHallLayoutResponse> update(@PathVariable Long hallSeq,
                                                            @RequestBody ConcertHallLayoutRequest request) {
        return ResponseEntity.ok(concertHallLayoutService.update(hallSeq, request));
    }

    @DeleteMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long hallSeq) {
        concertHallLayoutService.delete(hallSeq);
        return ResponseEntity.noContent().build();
    }
}
