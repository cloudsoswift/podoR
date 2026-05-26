package cloudsoswift.podoR.domain.concerthall.dto;

import cloudsoswift.podoR.domain.concerthall.entity.ConcertHallLayout;
import lombok.Getter;

@Getter
public class ConcertHallLayoutResponse {
    private Long seq;
    private Long hallSeq;
    private String layoutJson;

    public ConcertHallLayoutResponse(ConcertHallLayout layout) {
        this.seq = layout.getSeq();
        this.hallSeq = layout.getConcertHall().getSeq();
        this.layoutJson = layout.getLayoutJson();
    }
}
