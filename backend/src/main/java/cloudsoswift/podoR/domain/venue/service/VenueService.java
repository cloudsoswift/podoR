package cloudsoswift.podoR.domain.venue.service;

import cloudsoswift.podoR.domain.venue.dto.VenueCreateRequest;
import cloudsoswift.podoR.domain.venue.dto.VenueResponse;
import cloudsoswift.podoR.domain.venue.dto.VenueUpdateRequest;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.domain.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class VenueService {

    private final VenueRepository venueRepository;

    public Page<VenueResponse> getList(Pageable pageable) {
        return venueRepository.findAll(pageable).map(VenueResponse::new);
    }

    public VenueResponse getOne(Long seq) {
        Venue venue = venueRepository.findById(seq)
                .orElseThrow(() -> new RuntimeException("Venue not found: " + seq));
        return new VenueResponse(venue);
    }

    @Transactional
    public VenueResponse create(VenueCreateRequest request) {
        Venue venue = Venue.builder()
                .name(request.getName())
                .address(request.getAddress())
                .description(request.getDescription())
                .venueImage(request.getVenueImage())
                .build();
        return new VenueResponse(venueRepository.save(venue));
    }

    @Transactional
    public VenueResponse update(Long seq, VenueUpdateRequest request) {
        Venue venue = venueRepository.findById(seq)
                .orElseThrow(() -> new RuntimeException("Venue not found: " + seq));
        venue.update(request.getName(), request.getAddress(),
                request.getDescription(), request.getVenueImage());
        return new VenueResponse(venue);
    }

    @Transactional
    public void delete(Long seq) {
        Venue venue = venueRepository.findById(seq)
                .orElseThrow(() -> new RuntimeException("Venue not found: " + seq));
        venueRepository.delete(venue);
    }
}
