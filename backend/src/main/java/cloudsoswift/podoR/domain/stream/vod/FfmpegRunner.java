package cloudsoswift.podoR.domain.stream.vod;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

/** ffmpeg 실행을 분리해 VOD 로직을 ffmpeg 없이 테스트한다. */
public interface FfmpegRunner {

    /** HLS 조각(.ts)들을 순서대로 이어 재인코딩 없이 mp4 로 만든다. 실패하면 IOException. */
    void concatToMp4(List<Path> segments, Path output) throws IOException;
}
