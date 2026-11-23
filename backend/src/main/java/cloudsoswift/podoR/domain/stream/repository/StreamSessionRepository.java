package cloudsoswift.podoR.domain.stream.repository;

import cloudsoswift.podoR.domain.stream.entity.StreamSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StreamSessionRepository extends JpaRepository<StreamSession, Long> {

    // 현재 세션 = 그 회차에서 session_no 가 가장 큰 행
    Optional<StreamSession> findTopByEvent_SeqOrderBySessionNoDesc(Long eventSeq);

    // VOD 이어 붙이기 순서
    List<StreamSession> findAllByEvent_SeqOrderBySessionNoAsc(Long eventSeq);
}
