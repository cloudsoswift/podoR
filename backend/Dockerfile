# syntax=docker/dockerfile:1
# ── build stage ──────────────────────────────────────────────────────
# 빌드 컨텍스트(./backend)에 podoR-config 서브모듈이 체크아웃돼 있어야 한다.
#   git submodule update --init
FROM eclipse-temurin:17-jdk AS build
WORKDIR /app
COPY . .
RUN chmod +x gradlew && ./gradlew clean bootJar -x test --no-daemon

# ── run stage ────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
# 메모리 제약 환경이면 JAVA_TOOL_OPTIONS=-Xmx512m 등을 compose env 로 주입 할 수 있음.
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
