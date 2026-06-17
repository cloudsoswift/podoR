package cloudsoswift.podoR.domain.venue.service;

import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.venue.dto.VenueCreateRequest;
import cloudsoswift.podoR.domain.venue.dto.VenueResponse;
import cloudsoswift.podoR.domain.venue.dto.VenueUpdateRequest;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.domain.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class VenueService {

    private final VenueRepository venueRepository;
    private final EventRepository eventRepository;

    public Page<VenueResponse> getList(Pageable pageable) {
        return venueRepository.findAllByDeletedAtIsNull(pageable).map(VenueResponse::new);
    }

    public VenueResponse getOne(Long seq) {
        return new VenueResponse(findActiveVenue(seq));
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
        Venue venue = findActiveVenue(seq);
        venue.update(request.getName(), request.getAddress(),
                request.getDescription(), request.getVenueImage());
        return new VenueResponse(venue);
    }

    @Transactional
    public void delete(Long seq) {
        Venue venue = findActiveVenue(seq);
        // 연결된 활성 이벤트가 있으면 삭제 거부 (409)
        if (eventRepository.existsByVenue_SeqAndDeletedDateIsNull(seq)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "연결된 이벤트가 있어 공연장을 삭제할 수 없습니다.");
        }
        venue.delete();
    }

    private Venue findActiveVenue(Long seq) {
        return venueRepository.findBySeqAndDeletedAtIsNull(seq)
                .orElseThrow(() -> new RuntimeException("Venue not found: " + seq));
    }
}
