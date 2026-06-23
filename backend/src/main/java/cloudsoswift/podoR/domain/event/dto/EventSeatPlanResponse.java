package cloudsoswift.podoR.domain.event.dto;

import lombok.Getter;

import java.util.List;
import java.util.Map;

/** 재편집 복원용: 현재 EventSeat 로 역산한 플랜. */
@Getter
public class EventSeatPlanResponse {
    private final List<EventSeatPlanRequest.GradeItem> grades;
    private final Map<String, String> sectionGrades;
    private final List<SeatKey> sellableSeats; // 현재 EventSeat 가 있는 좌석(키)

    public EventSeatPlanResponse(List<EventSeatPlanRequest.GradeItem> grades,
                                 Map<String, String> sectionGrades,
                                 List<SeatKey> sellableSeats) {
        this.grades = grades;
        this.sectionGrades = sectionGrades;
        this.sellableSeats = sellableSeats;
    }
}
