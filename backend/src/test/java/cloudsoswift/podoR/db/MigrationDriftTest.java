package cloudsoswift.podoR.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * db/migration 의 Flyway 마이그레이션이 JPA 엔티티와 어긋나지 않는지 검증한다.
 *
 * 다른 테스트들은 H2 에 Hibernate 가 새로 만든 스키마를 쓰므로(테스트 yml 에서 Flyway 꺼짐),
 * 마이그레이션 없이 엔티티만 바꿔도 전부 통과한다. 이를 보완하고자
 * 빈 postgres 컨테이너에 서버와 같은 방식(앱 기동 시 Flyway)으로 마이그레이션을 적용한 뒤,
 * Hibernate 를 ddl-auto=validate 로 붙여 구동한다. 엔티티와 맞지 않으면 컨텍스트 기동 자체가 실패한다.
 *
 * 다만 `ddl-auto=validate` 는 테이블·컬럼·타입만 보므로,
 * 제약조건·인덱스·FK·nullable 은 검사하지 않음.
 */
@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.flyway.enabled=true",
        "spring.flyway.schemas=podor",
        "spring.flyway.default-schema=podor",
        // 테스트 yml 의 defer-datasource-initialization=true 는 Flyway 와 순환 의존(flyway <-> entityManagerFactory)을 만든다
        "spring.jpa.defer-datasource-initialization=false"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class MigrationDriftTest {

    private static final String DB_NAME = "podor_schema_check";
    private static final String DB_USER = "postgres";
    private static final String DB_PASSWORD = "test-password";

    private static final GenericContainer<?> POSTGRES;

    static {
        POSTGRES = new GenericContainer<>("postgres:16")
                .withEnv("POSTGRES_DB", DB_NAME)
                .withEnv("POSTGRES_USER", DB_USER)
                .withEnv("POSTGRES_PASSWORD", DB_PASSWORD)
                .withExposedPorts(5432)
                // 공식 이미지는 초기화 중에 임시 서버를 한 번 띄웠다 내리므로 준비 로그가 두 번 찍힌다.
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

    @Autowired
    JdbcTemplate jdbc;

    /**
     * 컨텍스트가 떴다는 것 자체가 마이그레이션 적용 + ddl-auto=validate 통과를 의미한다.
     * 마이그레이션에 테이블/컬럼이 빠지거나 타입이 어긋나면 여기서 기동 실패로 잡힌다.
     */
    @Test
    void 마이그레이션으로_만든_스키마가_엔티티와_일치한다() {
        Integer applied = jdbc.queryForObject(
                "select count(*) from podor.flyway_schema_history where success", Integer.class);
        assertThat(applied).isPositive();
    }

    @Test
    void updated_at_트리거_함수는_podor_스키마에_생긴다() {
        String schema = jdbc.queryForObject(
                "select n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace"
                        + " where p.proname = 'update_updated_at_column'", String.class);
        assertThat(schema).isEqualTo("podor");
    }
}
