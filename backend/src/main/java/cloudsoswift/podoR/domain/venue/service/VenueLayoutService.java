package cloudsoswift.podoR.domain.venue.service;

import cloudsoswift.podoR.domain.venue.dto.VenueLayoutRequest;
import cloudsoswift.podoR.domain.venue.dto.VenueLayoutResponse;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.domain.venue.entity.VenueLayout;
import cloudsoswift.podoR.domain.venue.repository.VenueLayoutRepository;
import cloudsoswift.podoR.domain.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class VenueLayoutService {

    private final VenueLayoutRepository venueLayoutRepository;
    private final VenueRepository venueRepository;

    public VenueLayoutResponse getOne(Long venueSeq) {
        VenueLayout layout = venueLayoutRepository.findByVenueSeq(venueSeq)
                .orElseThrow(() -> new RuntimeException("VenueLayout not found for venueSeq: " + venueSeq));
        return new VenueLayoutResponse(layout);
    }

    @Transactional
    public VenueLayoutResponse create(Long venueSeq, VenueLayoutRequest request) {
        if (venueLayoutRepository.existsByVenueSeq(venueSeq)) {
            throw new IllegalStateException("Layout already exists for venueSeq: " + venueSeq);
        }
        Venue venue = venueRepository.findById(venueSeq)
                .orElseThrow(() -> new RuntimeException("Venue not found: " + venueSeq));
        VenueLayout layout = VenueLayout.builder()
                .venue(venue)
                .layoutJson(request.getLayoutJson())
                .build();
        return new VenueLayoutResponse(venueLayoutRepository.save(layout));
    }

    @Transactional
    public VenueLayoutResponse update(Long venueSeq, VenueLayoutRequest request) {
        VenueLayout layout = venueLayoutRepository.findByVenueSeq(venueSeq)
                .orElseThrow(() -> new RuntimeException("VenueLayout not found for venueSeq: " + venueSeq));
        layout.update(request.getLayoutJson());
        return new VenueLayoutResponse(layout);
    }

    @Transactional
    public void delete(Long venueSeq) {
        VenueLayout layout = venueLayoutRepository.findByVenueSeq(venueSeq)
                .orElseThrow(() -> new RuntimeException("VenueLayout not found for venueSeq: " + venueSeq));
        venueLayoutRepository.delete(layout);
    }
}
