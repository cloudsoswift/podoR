package cloudsoswift.podoR.security.jwt;

import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.security.oauth.provider.CustomOAuth2User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Base64;
import java.util.Date;

@Component
public class JwtTokenProvider {

    private final Key key;

    // Access: 짧게 (예: 1시간), Refresh: 길게 (예: 2주)
    private static final long ACCESS_TOKEN_EXPIRE_MS  = 1000L * 60 * 60;
    private static final long REFRESH_TOKEN_EXPIRE_MS = 1000L * 60 * 60 * 24 * 14;

    public JwtTokenProvider(@Value("${jwt.secret}") String secretKey) {
        byte[] keyBytes = Base64.getDecoder().decode(secretKey);
        this.key = Keys.hmacShaKeyFor(keyBytes);
    }

    // Authentication에서 Principal(CustomOAuth2User) 꺼내서 sub/role 클레임 세팅
    public String generateAccessToken(Authentication authentication) {
        CustomOAuth2User principal = (CustomOAuth2User) authentication.getPrincipal();
        User user = principal.getUser();

        Date now = new Date();
        return Jwts.builder()
                .setSubject(String.valueOf(user.getSeq()))  // seq가 Long 타입
                .claim("email", user.getEmail())
                .claim("role", user.getRole())
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

    // 이후 Security Filter에서 쓸 검증/파싱 메서드들도 있을 가능성 높음
    public boolean validateToken(String token) {
        try {
            Jwts.parser().setSigningKey(key).build().parseClaimsJws(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public Long getUserSeq(String token) {
        Claims claims = Jwts.parser()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
        return Long.parseLong(claims.getSubject());
    }
}