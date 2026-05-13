package cloudsoswift.podoR.config;

import cloudsoswift.podoR.security.jwt.JwtAuthenticationFilter;
import cloudsoswift.podoR.security.oauth.CustomOAuth2UserService;
import cloudsoswift.podoR.security.oauth.OAuth2AuthenticationFailureHandler;
import cloudsoswift.podoR.security.oauth.OAuth2AuthenticationSuccessHandler;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2AuthenticationSuccessHandler successHandler;
    private final OAuth2AuthenticationFailureHandler failureHandler;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/", "/error", "/favicon.ico").permitAll()
                        .requestMatchers("/login", "/oauth2/**").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(exception -> exception
                        // 인증되지 않은 사용자가 인증이 필요한 API에 접근할 때 동작
                        // 기본값은 Spring Security 로그인 페이지로 리다이렉트인데,
                        // 이를 덮어써서 401 JSON 응답을 반환하도록 커스터마이징
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED); // 401
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write(
                                    "{\"error\": \"Unauthorized\", \"message\": \"로그인이 필요합니다.\"}"
                            );
                        })
                )
                .oauth2Login(oauth2 -> oauth2
                        .redirectionEndpoint(redirection ->
                                redirection.baseUri("/login/oauth2/code/*"))
                        .userInfoEndpoint(userInfo ->
                                userInfo.userService(customOAuth2UserService))
                        .successHandler(successHandler)
                        .failureHandler(failureHandler))
                .addFilterBefore(jwtAuthenticationFilter,
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}