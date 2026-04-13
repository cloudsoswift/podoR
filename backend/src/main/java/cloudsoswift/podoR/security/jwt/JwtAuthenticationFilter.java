package cloudsoswift.podoR.security.jwt;

import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.user.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
// 매 요청마다 JWT 토큰 검증하여, SecurityContext에 추가
// OncePerRequestFilter를 상속하기 때문에 요청당 딱 한 번만 실행되고,
// UsernamePasswordAuthenticationFilter 앞에 위치해서 그 전에 JWT 인증을 먼저 처리함.

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        // 1. Request Header에서 JWT 토큰 추출
        String token = resolveToken(request);

        // 2. 토큰 유효성 검증
        if (StringUtils.hasText(token) && jwtTokenProvider.validateToken(token)) {

            // 3. 토큰에서 userSeq 추출 후 DB 조회
            Long userSeq = jwtTokenProvider.getUserSeq(token);
            User user = userRepository.findById(userSeq)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            // 4. SecurityContext에 Authentication 등록
            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(
                            user,
                            null,
                            Collections.singletonList(
                                    new SimpleGrantedAuthority("ROLE_" + user.getRole()))
                    );

            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        filterChain.doFilter(request, response);
    }

    // "Bearer {token}" 형태에서 토큰만 추출
    private String resolveToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}