package cloudsoswift.podoR.domain.venue.service;

import cloudsoswift.podoR.domain.seat.entity.Seat;
import cloudsoswift.podoR.domain.seat.repository.SeatRepository;
import cloudsoswift.podoR.domain.venue.dto.VenueSeatmapRequest;
import cloudsoswift.podoR.domain.venue.dto.VenueSeatmapResponse;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.domain.venue.entity.VenueLayout;
import cloudsoswift.podoR.domain.venue.repository.VenueLayoutRepository;
import cloudsoswift.podoR.domain.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 섹션 배치(layout)와 좌석 목록을 한 트랜잭션으로 등록한다.
 * - layout: VenueLayout 1:1 upsert
 * - seats: 해당 venue 의 좌석을 전부 교체(삭제 후 일괄 저장)
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class VenueSeatmapService {

    private final VenueRepository venueRepository;
    private final VenueLayoutRepository venueLayoutRepository;
    private final SeatRepository seatRepository;

    @Transactional
    public VenueSeatmapResponse register(Long venueSeq, VenueSeatmapRequest request) {
        Venue venue = venueRepository.findById(venueSeq)
                .orElseThrow(() -> new RuntimeException("Venue not found: " + venueSeq));

        // 1) 레이아웃 upsert
        boolean layoutSaved = false;
        if (request.getLayoutJson() != null) {
            venueLayoutRepository.findByVenueSeq(venueSeq)
                    .ifPresentOrElse(
                            layout -> layout.update(request.getLayoutJson()),
                            () -> venueLayoutRepository.save(VenueLayout.builder()
                                    .venue(venue)
                                    .layoutJson(request.getLayoutJson())
                                    .build())
                    );
            layoutSaved = true;
        }

        // 2) 좌석 전체 교체(기존 좌석 삭제 후 새로 저장)
        seatRepository.deleteByVenueSeq(venueSeq);
        List<Seat> seats = new ArrayList<>();
        if (request.getSeats() != null) {
            for (VenueSeatmapRequest.SeatItem item : request.getSeats()) {
                seats.add(Seat.builder()
                        .venue(venue)
                        .section(item.getSection())
                        .rowNumber(item.getRowNumber())
                        .seatNumber(item.getSeatNumber())
                        .isAvailable(item.getIsAvailable())
                        .build());
            }
            seatRepository.saveAll(seats);
        }

        return new VenueSeatmapResponse(venueSeq, layoutSaved, seats.size());
    }
}
