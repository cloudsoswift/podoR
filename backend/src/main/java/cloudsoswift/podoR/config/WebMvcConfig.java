package cloudsoswift.podoR.config;

import cloudsoswift.podoR.domain.stream.StreamProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 프로젝트 최초의 WebMvcConfigurer. 입장권 게이트 등록 지점이다.
 */
// StreamProperties 를 여기서도 활성화해, 이 설정만 @Import 하는 슬라이스 테스트에서도 내부 토큰 인터셉터가 뜬다.
@Configuration
@EnableConfigurationProperties(StreamProperties.class)
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final QueuePassInterceptor queuePassInterceptor;
    private final StreamProperties streamProperties;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(queuePassInterceptor)
                .addPathPatterns(
                        "/events/*/seat-view",
                        "/events/*/seat-view/changes",
                        "/events/*/my-seat-quota",
                        "/events/*/holds",
                        // 단일 '*' 는 '/' 를 넘지 않으므로 /events/*/order/{orderNumber}(주문 취소)는
                        // 여기 걸리지 않는다. 취소는 마이페이지에서 대기 없이 되어야 한다.
                        "/events/*/order");
        // MediaMTX 내부 콜백. 미디어 authorize(/internal/media/**)는 쿠키 서명으로 판정하므로 제외.
        registry.addInterceptor(new InternalTokenInterceptor(streamProperties))
                .addPathPatterns("/internal/stream/**");
    }
}
