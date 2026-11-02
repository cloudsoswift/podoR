package cloudsoswift.podoR.domain.stream.vod;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class VodExecutorConfig {

    /** VOD 변환 전용. 디스크 I/O 가 큰 작업이라 한 번에 하나만 돈다. */
    @Bean("vodExecutor")
    public ThreadPoolTaskExecutor vodExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("vod-");
        executor.initialize();
        return executor;
    }
}
