package cloudsoswift.podoR.security.jwt;

import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.security.oauth.provider.CustomOAuth2User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Base64;
import java.util.Date;
import java.util.List;

@Component
@Log4j2
public class JwtTokenProvider {

    private final Key key;

    @Value("${jwt.access-token-expiration}")
    private long ACCESS_TOKEN_EXPIRE_MS;

    @Value("${jwt.refresh-token-expiration}")
    private long REFRESH_TOKEN_EXPIRE_MS;

    public JwtTokenProvider(@Value("${jwt.secret}") String secretKey) {
        byte[] keyBytes = Base64.getDecoder().decode(secretKey); // Base64로 인코딩하여 사용
        this.key = Keys.hmacShaKeyFor(keyBytes);
    }

    // Authentication에서 Principal(CustomOAuth2User) 꺼내서 sub/role 클레임 세팅
    public String generateAccessToken(Authentication authentication) {
        CustomOAuth2User principal = (CustomOAuth2User) authentication.getPrincipal();
        User user = principal.getUser();
        return generateAccessToken(user.getSeq(), user.getRole().name());
    }

    // RT 기반 재발급용 - userSeq와 role만으로 AT 생성
    public String generateAccessToken(Long userSeq, String role) {
        Date now = new Date();
        return Jwts.builder()
                .setSubject(String.valueOf(userSeq))
                .claim("role", role)
                .setIssuedAt(now)
                .setExpiration(new Date(now.getTime() + ACCESS_TOKEN_EXPIRE_MS))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    // Refresh는 최소 정보만 (seq만 subject로)
    public String generateRefreshToken(Long userSeq) {
        Date now = new Date();
        return Jwts.builder()
                .setSubject(String.valueOf(userSeq))
                .setIssuedAt(now)
                .setExpiration(new Date(now.getTime() + REFRESH_TOKEN_EXPIRE_MS))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder()
                    .setSigningKey(key)
                    .build()
                    .parseClaimsJws(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.warn("JWT 만료: {}", e.getMessage());
        } catch (UnsupportedJwtException e) {
            log.warn("지원하지 않는 JWT: {}", e.getMessage());
        } catch (MalformedJwtException e) {
            log.warn("잘못된 JWT 형식: {}", e.getMessage());
        } catch (SecurityException e) {
            log.warn("JWT 서명 오류: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            log.warn("JWT Claims 비어 있음: {}", e.getMessage());
        }
        return false;
    }

    public Long getUserSeq(String token) {
        return Long.parseLong(parseClaims(token).getSubject());
    }

    private Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public Authentication getAuthentication(String token) {
        Claims claims = parseClaims(token);

        String role = claims.get("role", String.class);
        Long userSeq = Long.parseLong(claims.getSubject());

        SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + role);

        // principal에 userSeq만 담아둠 (DB 조회 없이)
        return new UsernamePasswordAuthenticationToken(userSeq, token, List.of(authority));
    }

    // 토큰이 만료됐지만 서명은 유효한지 확인
    public boolean isExpired(String token) {
        try {
            parseClaims(token);
            return false;
        } catch (ExpiredJwtException e) {
            return true;
        }
    }
}