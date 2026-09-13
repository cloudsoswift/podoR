package cloudsoswift.podoR.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 프로젝트 최초의 WebMvcConfigurer. 입장권 게이트 등록 지점이다.
 */
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final QueuePassInterceptor queuePassInterceptor;

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
    }
}
