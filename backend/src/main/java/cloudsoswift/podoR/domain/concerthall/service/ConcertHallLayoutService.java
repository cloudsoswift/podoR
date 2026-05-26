package cloudsoswift.podoR.domain.concerthall.service;

import cloudsoswift.podoR.domain.concerthall.dto.ConcertHallLayoutRequest;
import cloudsoswift.podoR.domain.concerthall.dto.ConcertHallLayoutResponse;
import cloudsoswift.podoR.domain.concerthall.entity.ConcertHall;
import cloudsoswift.podoR.domain.concerthall.entity.ConcertHallLayout;
import cloudsoswift.podoR.domain.concerthall.repository.ConcertHallLayoutRepository;
import cloudsoswift.podoR.domain.concerthall.repository.ConcertHallRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ConcertHallLayoutService {

    private final ConcertHallLayoutRepository layoutRepository;
    private final ConcertHallRepository concertHallRepository;

    public ConcertHallLayoutResponse getOne(Long hallSeq) {
        ConcertHallLayout layout = layoutRepository.findByConcertHallSeq(hallSeq)
                .orElseThrow(() -> new RuntimeException("ConcertHallLayout not found for hallSeq: " + hallSeq));
        return new ConcertHallLayoutResponse(layout);
    }

    @Transactional
    public ConcertHallLayoutResponse create(Long hallSeq, ConcertHallLayoutRequest request) {
        if (layoutRepository.existsByConcertHallSeq(hallSeq)) {
            throw new IllegalStateException("Layout already exists for hallSeq: " + hallSeq);
        }
        ConcertHall concertHall = concertHallRepository.findById(hallSeq)
                .orElseThrow(() -> new RuntimeException("ConcertHall not found: " + hallSeq));
        ConcertHallLayout layout = ConcertHallLayout.builder()
                .concertHall(concertHall)
                .layoutJson(request.getLayoutJson())
                .build();
        return new ConcertHallLayoutResponse(layoutRepository.save(layout));
    }

    @Transactional
    public ConcertHallLayoutResponse update(Long hallSeq, ConcertHallLayoutRequest request) {
        ConcertHallLayout layout = layoutRepository.findByConcertHallSeq(hallSeq)
                .orElseThrow(() -> new RuntimeException("ConcertHallLayout not found for hallSeq: " + hallSeq));
        layout.update(request.getLayoutJson());
        return new ConcertHallLayoutResponse(layout);
    }

    @Transactional
    public void delete(Long hallSeq) {
        ConcertHallLayout layout = layoutRepository.findByConcertHallSeq(hallSeq)
                .orElseThrow(() -> new RuntimeException("ConcertHallLayout not found for hallSeq: " + hallSeq));
        layoutRepository.delete(layout);
    }
}
