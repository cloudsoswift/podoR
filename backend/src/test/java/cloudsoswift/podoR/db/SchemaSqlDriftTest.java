package cloudsoswift.podoR.db;

import org.junit.jupiter.api.Test;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.MountableFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * db/schema.sql 이 JPA 엔티티와 어긋나지 않는지 검증한다.
 *
 * 현재 다른 테스트들은 H2 DB에다가 Hibernate가 새로 만든 스키마를 쓰기 때문에,
 * 실제 DB의 테이블 구조를 나타내는 `schema.sql`이 엔티티와 어긋나도 전부 통과하게 됨.
 * 따라서 이를 보완하고자 schema.sql와 JPA 엔티티가 매칭되는지 검사하는 테스트를 추가
 * 
 * postgres 컨테이너의 `/docker-entrypoint-initdb.d` 에 `schema.sql`을 넣어
 * "docker-compose와 완전히 동일한 경로"로 스키마를 만든 뒤, Hibernate를 ddl-auto=validate로 붙여 구동.
 * 이때, 엔티티와 맞지 않으면 컨텍스트 기동 자체가 실패한다.
 *
 * 다만 현재 방법의 `ddl-auto=validate` 는 테이블·컬럼·타입만 보므로,
 * 제약조건·인덱스·FK·nullable 은 검사하지 않음.
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class SchemaSqlDriftTest {

    private static final String DB_NAME = "podor_schema_check";
    private static final String DB_USER = "postgres";
    private static final String DB_PASSWORD = "test-password";

    private static final GenericContainer<?> POSTGRES;

    static {
        // backend/ 내에서 db/schema.sql 위치를 탐색
        Path schemaSql = Paths.get("db/schema.sql").toAbsolutePath().normalize();
        if (!Files.exists(schemaSql)) {
            throw new IllegalStateException("schema.sql 을 찾을 수 없습니다: " + schemaSql);
        }
        POSTGRES = new GenericContainer<>("postgres:16")
                .withEnv("POSTGRES_DB", DB_NAME)
                .withEnv("POSTGRES_USER", DB_USER)
                .withEnv("POSTGRES_PASSWORD", DB_PASSWORD)
                // compose 와 동일: 빈 볼륨 최초 기동 시 이 디렉터리의 스크립트가 실행된다.
                .withCopyFileToContainer(
                        MountableFile.forHostPath(schemaSql),
                        "/docker-entrypoint-initdb.d/01-schema.sql")
                .withExposedPorts(5432)
                // 초기화 스크립트 실행 전후로 같은 로그가 두 번 찍힌다.
                // 2회를 기다려야 스크립트 완료가 보장된다.
                .waitingFor(Wait.forLogMessage(
                        ".*database system is ready to accept connections.*", 2));
        POSTGRES.start(); // @DynamicPropertySource 평가 전에 떠 있어야 한다
    }

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        String url = "jdbc:postgresql://%s:%d/%s?currentSchema=podor"
                .formatted(POSTGRES.getHost(), POSTGRES.getMappedPort(5432), DB_NAME);
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> DB_USER);
        registry.add("spring.datasource.password", () -> DB_PASSWORD);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }

    /**
     * 컨텍스트가 떴다는 것 자체가 ddl-auto=validate 통과를 의미한다.
     * schema.sql 에 테이블/컬럼이 빠지거나 타입이 어긋나면 여기서 기동 실패로 잡힌다.
     */
    @Test
    void schema_sql_로_만든_스키마가_엔티티와_일치한다() {
    }
}
