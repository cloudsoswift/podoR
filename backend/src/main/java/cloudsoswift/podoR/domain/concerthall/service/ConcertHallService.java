package cloudsoswift.podoR.domain.concerthall.service;

import cloudsoswift.podoR.domain.concerthall.dto.ConcertHallCreateRequest;
import cloudsoswift.podoR.domain.concerthall.dto.ConcertHallResponse;
import cloudsoswift.podoR.domain.concerthall.dto.ConcertHallUpdateRequest;
import cloudsoswift.podoR.domain.concerthall.entity.ConcertHall;
import cloudsoswift.podoR.domain.concerthall.repository.ConcertHallRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ConcertHallService {

    private final ConcertHallRepository concertHallRepository;

    public Page<ConcertHallResponse> getList(Pageable pageable) {
        return concertHallRepository.findAll(pageable).map(ConcertHallResponse::new);
    }

    public ConcertHallResponse getOne(Long seq) {
        ConcertHall concertHall = concertHallRepository.findById(seq)
                .orElseThrow(() -> new RuntimeException("ConcertHall not found: " + seq));
        return new ConcertHallResponse(concertHall);
    }

    @Transactional
    public ConcertHallResponse create(ConcertHallCreateRequest request) {
        ConcertHall concertHall = ConcertHall.builder()
                .name(request.getName())
                .address(request.getAddress())
                .description(request.getDescription())
                .concertHallImage(request.getConcertHallImage())
                .build();
        return new ConcertHallResponse(concertHallRepository.save(concertHall));
    }

    @Transactional
    public ConcertHallResponse update(Long seq, ConcertHallUpdateRequest request) {
        ConcertHall concertHall = concertHallRepository.findById(seq)
                .orElseThrow(() -> new RuntimeException("ConcertHall not found: " + seq));
        concertHall.update(request.getName(), request.getAddress(),
                request.getDescription(), request.getConcertHallImage());
        return new ConcertHallResponse(concertHall);
    }

    @Transactional
    public void delete(Long seq) {
        ConcertHall concertHall = concertHallRepository.findById(seq)
                .orElseThrow(() -> new RuntimeException("ConcertHall not found: " + seq));
        concertHallRepository.delete(concertHall);
    }
}
