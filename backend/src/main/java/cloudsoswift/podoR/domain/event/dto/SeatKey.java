package cloudsoswift.podoR.domain.event.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.Objects;

/** 좌석 식별 키 (섹션명 + 행 라벨 + 좌석번호). 프론트가 seatSeq 를 몰라도 좌석을 지정할 수 있게 한다. */
@Getter
@NoArgsConstructor
public class SeatKey {
    private String section;
    private String rowNumber;
    private Integer seatNumber;

    public SeatKey(String section, String rowNumber, Integer seatNumber) {
        this.section = section;
        this.rowNumber = rowNumber;
        this.seatNumber = seatNumber;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof SeatKey other)) return false;
        return Objects.equals(section, other.section)
                && Objects.equals(rowNumber, other.rowNumber)
                && Objects.equals(seatNumber, other.seatNumber);
    }

    @Override
    public int hashCode() {
        return Objects.hash(section, rowNumber, seatNumber);
    }
}
