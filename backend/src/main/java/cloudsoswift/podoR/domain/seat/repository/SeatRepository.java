package cloudsoswift.podoR.domain.seat.repository;

import cloudsoswift.podoR.domain.seat.entity.Seat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SeatRepository extends JpaRepository<Seat, Long> {
    List<Seat> findByVenueSeq(Long venueSeq);

    /**
     * 좌석 전체 교체용 벌크 삭제.
     * 파생 삭제(SELECT 후 em.remove)는 flush 시 insert 가 delete 보다 먼저 실행돼
     * (좌석 재저장 시) seat_unique 제약을 위반한다. 벌크 DML 로 호출 즉시 DELETE 를 실행해
     * 이후 saveAll 의 insert 보다 앞서도록 한다.
     */
    @Modifying
    @Query("DELETE FROM Seat s WHERE s.venue.seq = :venueSeq")
    void deleteByVenueSeq(@Param("venueSeq") Long venueSeq);

    long countByVenueSeq(Long venueSeq);
}
