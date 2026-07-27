package cloudsoswift.podoR.domain.event.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/** 좌석 플랜 저장 요청. */
@Getter
@NoArgsConstructor
public class EventSeatPlanRequest {
    private List<GradeItem> grades;            // 등급표
    private Map<String, String> sectionGrades; // 섹션명 -> grade
    private List<SeatKey> excludedSeats;       // 등급 섹션 내 이번 이벤트 미가용 좌석(키)

    @Getter
    @NoArgsConstructor
    public static class GradeItem {
        private String grade;
        private Integer price;

        public static GradeItem of(String grade, Integer price) {
            GradeItem g = new GradeItem();
            g.grade = grade;
            g.price = price;
            return g;
        }
    }
}
