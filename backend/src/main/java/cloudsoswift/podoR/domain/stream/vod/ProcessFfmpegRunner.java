package cloudsoswift.podoR.domain.stream.vod;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * concat demuxer 로 조각을 잇는다(-c copy, 재인코딩 없음).
 * 출력 파일은 임시 확장자일 수 있어 포맷을 -f mp4 로 명시하고, +faststart 로 moov 를 앞에 둬
 * 브라우저가 전체를 받기 전에 재생·탐색할 수 있게 한다.
 */
@Component
public class ProcessFfmpegRunner implements FfmpegRunner {

    private static final long TIMEOUT_HOURS = 2;
    private static final int TAIL_BYTES = 2048;

    @Override
    public void concatToMp4(List<Path> segments, Path output) throws IOException {
        Path list = Files.createTempFile("vod-concat-", ".txt");
        try {
            StringBuilder sb = new StringBuilder();
            for (Path p : segments) {
                // concat 목록 문법: 작은따옴표 안의 ' 는 '\'' 로 끊어 쓴다
                sb.append("file '").append(p.toAbsolutePath().toString().replace("'", "'\\''")).append("'\n");
            }
            Files.writeString(list, sb.toString(), StandardCharsets.UTF_8);

            Process process = new ProcessBuilder(
                    "ffmpeg", "-hide_banner", "-y",
                    "-f", "concat", "-safe", "0", "-i", list.toString(),
                    "-c", "copy", "-bsf:a", "aac_adtstoasc",
                    "-movflags", "+faststart", "-f", "mp4", output.toString())
                    .redirectErrorStream(true)
                    .start();
            String tail = readTail(process.getInputStream());
            boolean finished = process.waitFor(TIMEOUT_HOURS, TimeUnit.HOURS);
            if (!finished) {
                process.destroyForcibly();
                throw new IOException("ffmpeg timed out");
            }
            if (process.exitValue() != 0) {
                throw new IOException("ffmpeg exit " + process.exitValue() + ": " + tail);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("interrupted", e);
        } finally {
            Files.deleteIfExists(list);
        }
    }

    // 출력을 계속 비워야 ffmpeg 가 파이프 버퍼에 막히지 않는다. 오류 보고용으로 끝부분만 남긴다.
    private static String readTail(InputStream in) throws IOException {
        byte[] ring = new byte[TAIL_BYTES];
        byte[] buf = new byte[8192];
        int total = 0;
        int n;
        while ((n = in.read(buf)) != -1) {
            for (int i = 0; i < n; i++) {
                ring[(total + i) % TAIL_BYTES] = buf[i];
            }
            total += n;
        }
        if (total <= TAIL_BYTES) {
            return new String(ring, 0, total, StandardCharsets.UTF_8);
        }
        int start = total % TAIL_BYTES;
        byte[] ordered = new byte[TAIL_BYTES];
        System.arraycopy(ring, start, ordered, 0, TAIL_BYTES - start);
        System.arraycopy(ring, 0, ordered, TAIL_BYTES - start, start);
        return new String(ordered, StandardCharsets.UTF_8);
    }
}
