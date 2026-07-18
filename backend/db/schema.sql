-- =====================================================================
-- podoR 전체 스키마 생성 스크립트 (PostgreSQL)
--
-- 목적   : 새 환경에서 이 파일 하나로 현재 DB 구조를 그대로 생성한다.
-- 기준   : 2026-06-27 시점, BE @Entity 와 정합된 상태(마이그레이션 반영 후).
-- 스키마 : podor
-- 실행   : psql -h <host> -U <user> -d <db> -f db/schema.sql
--
-- 주의   : 기존 podor 스키마가 있으면 충돌할 수 있다. 완전 초기화가 필요하면
--          맨 아래 "초기화" 주석 블록을 먼저 실행하라(데이터 전부 삭제됨).
-- =====================================================================

-- (초기화가 필요할 때만 주석 해제)
-- DROP SCHEMA IF EXISTS podor CASCADE;

CREATE SCHEMA IF NOT EXISTS podor;
SET search_path TO podor;

-- ---------------------------------------------------------------------
-- 공통 함수: updated_at 자동 갱신 트리거용
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE users (
    seq           bigserial    NOT NULL,
    email         varchar(255) NOT NULL,
    nickname      varchar(100) NOT NULL,
    provider      varchar(20)  NOT NULL,
    provider_id   varchar(255) NOT NULL,
    role          varchar(20)  NOT NULL DEFAULT 'USER',
    phone         varchar(50),
    birthday      date,
    profile_image varchar(500),
    created_at    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at    timestamp,
    CONSTRAINT "PK_USER" PRIMARY KEY (seq),
    CONSTRAINT uk_user_provider UNIQUE (provider, provider_id)
);
COMMENT ON COLUMN users.provider    IS 'GOOGLE, KAKAO';
COMMENT ON COLUMN users.provider_id IS 'OAuth 제공자 고유 ID';
COMMENT ON COLUMN users.role        IS 'USER, ADMIN';

CREATE TRIGGER update_user_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- venue
-- ---------------------------------------------------------------------
CREATE TABLE venue (
    seq         bigserial     NOT NULL,
    name        varchar(255)  NOT NULL,
    address     varchar(1000) NOT NULL,
    description text,
    venue_image varchar(500),
    created_at  timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at  timestamp,
    CONSTRAINT "PK_VENUE" PRIMARY KEY (seq)
);

CREATE TRIGGER update_venue_updated_at
    BEFORE UPDATE ON venue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- venue_layout (venue 1:1)
-- ---------------------------------------------------------------------
CREATE TABLE venue_layout (
    seq         bigserial NOT NULL,
    venue_seq   bigint    NOT NULL,
    layout_json text,
    CONSTRAINT "PK_VENUE_LAYOUT" PRIMARY KEY (seq),
    CONSTRAINT "FK_venue_TO_venue_layout_1" FOREIGN KEY (venue_seq) REFERENCES venue(seq)
);

-- ---------------------------------------------------------------------
-- seat (공연장 물리 좌석)
-- ---------------------------------------------------------------------
CREATE TABLE seat (
    seq          bigserial   NOT NULL,
    venue_seq    bigint      NOT NULL,
    section      varchar(20) NOT NULL,
    row_number   varchar(10) NOT NULL,
    seat_number  integer,
    is_available boolean     NOT NULL DEFAULT true,
    CONSTRAINT "PK_SEAT" PRIMARY KEY (seq),
    CONSTRAINT uk_seat_location UNIQUE (venue_seq, section, row_number, seat_number),
    CONSTRAINT "FK_venue_TO_seat_1" FOREIGN KEY (venue_seq) REFERENCES venue(seq)
);
CREATE INDEX idx_seat_venue ON seat (venue_seq);

-- ---------------------------------------------------------------------
-- event (단일 회차. series_id 로 같은 공연의 여러 회차를 묶는다)
-- ---------------------------------------------------------------------
CREATE TABLE event (
    seq            bigserial    NOT NULL,
    host_seq       bigint       NOT NULL,
    event_id       varchar(255) NOT NULL,
    series_id      varchar(255) NOT NULL,
    title          varchar(255) NOT NULL,
    content        text,
    event_type     varchar(50)  NOT NULL,
    created_date   timestamp    NOT NULL,
    deleted_date   timestamp,
    event_date     timestamp    NOT NULL,
    ticketing_date timestamp    NOT NULL,
    stream_key     varchar(255),
    stream_status  varchar(20),
    venue_seq      bigint       NOT NULL,
    CONSTRAINT "PK_EVENT" PRIMARY KEY (seq),
    CONSTRAINT uk_event_event_id UNIQUE (event_id),
    CONSTRAINT "FK_user_TO_event_1"  FOREIGN KEY (host_seq)  REFERENCES users(seq),
    CONSTRAINT "FK_venue_TO_event_1" FOREIGN KEY (venue_seq) REFERENCES venue(seq)
);
COMMENT ON COLUMN event.event_id      IS 'UUID 형태의 이벤트 식별자';
COMMENT ON COLUMN event.series_id     IS '같은 공연의 여러 회차를 묶는 그룹키';
COMMENT ON COLUMN event.stream_status IS 'SCHEDULED, LIVE, ENDED';
CREATE INDEX idx_event_host ON event (host_seq);

-- ---------------------------------------------------------------------
-- event_seat (이벤트별 판매 좌석. 존재 자체가 '이번 이벤트 가용')
-- ---------------------------------------------------------------------
CREATE TABLE event_seat (
    seq            bigserial   NOT NULL,
    event_seq      bigint      NOT NULL,
    seat_seq       bigint      NOT NULL,
    seat_grade     varchar(10) NOT NULL,
    price          integer     NOT NULL,
    status         varchar(20) NOT NULL,
    change_version bigint      NOT NULL,
    CONSTRAINT "PK_EVENT_SEAT" PRIMARY KEY (seq),
    CONSTRAINT uk_event_seat UNIQUE (event_seq, seat_seq),
    CONSTRAINT "FK_event_TO_event_seat_1" FOREIGN KEY (event_seq) REFERENCES event(seq),
    CONSTRAINT "FK_seat_TO_event_seat_1"  FOREIGN KEY (seat_seq)  REFERENCES seat(seq)
);
COMMENT ON COLUMN event_seat.status         IS 'AVAILABLE, SOLD (HELD 는 Phase 2)';
COMMENT ON COLUMN event_seat.change_version IS 'Event 단위 단조증가 커서(증분 조회용)';
CREATE INDEX ix_event_seat_change ON event_seat (event_seq, change_version);

-- ---------------------------------------------------------------------
-- follow (팔로워-호스트 다대다)
-- ---------------------------------------------------------------------
CREATE TABLE follow (
    follower_seq bigint    NOT NULL,
    host_seq     bigint    NOT NULL,
    followed_at  timestamp NOT NULL,
    CONSTRAINT "PK_FOLLOW" PRIMARY KEY (follower_seq, host_seq),
    CONSTRAINT "FK_user_TO_follow_follower" FOREIGN KEY (follower_seq) REFERENCES users(seq),
    CONSTRAINT "FK_user_TO_follow_host"     FOREIGN KEY (host_seq)     REFERENCES users(seq)
);
CREATE INDEX idx_follow_host ON follow (host_seq);

-- ---------------------------------------------------------------------
-- ticketing_order (예매 주문 — Phase 2)
-- ---------------------------------------------------------------------
CREATE TABLE ticketing_order (
    seq          bigserial    NOT NULL,
    event_seq    bigint       NOT NULL,
    user_seq     bigint       NOT NULL,
    order_number varchar(100) NOT NULL,
    total_price  integer      NOT NULL,
    status       varchar(20)  NOT NULL,
    ordered_at   timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at timestamp,
    CONSTRAINT "PK_TICKETING_ORDER" PRIMARY KEY (seq),
    CONSTRAINT uk_ticketing_order_number UNIQUE (order_number),
    CONSTRAINT "FK_event_TO_ticketing_order_1" FOREIGN KEY (event_seq) REFERENCES event(seq),
    CONSTRAINT "FK_user_TO_ticketing_order_1"  FOREIGN KEY (user_seq)  REFERENCES users(seq)
);

-- ---------------------------------------------------------------------
-- ticketing_item (주문 항목 — Phase 2)
-- ---------------------------------------------------------------------
CREATE TABLE ticketing_item (
    seq                 bigserial NOT NULL,
    ticketing_order_seq bigint    NOT NULL,
    event_seat_seq      bigint    NOT NULL,
    CONSTRAINT "PK_TICKETING_ITEM" PRIMARY KEY (seq),
    CONSTRAINT "FK_ticketing_order_TO_ticketing_item_1" FOREIGN KEY (ticketing_order_seq) REFERENCES ticketing_order(seq),
    CONSTRAINT "FK_event_seat_TO_ticketing_item_1"      FOREIGN KEY (event_seat_seq)      REFERENCES event_seat(seq)
);

-- ---------------------------------------------------------------------
-- payment (결제 — Phase 2. 현재 대응 BE 엔티티 없음, DB 구조 보존용)
-- ---------------------------------------------------------------------
CREATE TABLE payment (
    seq                 bigserial   NOT NULL,
    ticketing_order_seq bigint      NOT NULL,
    payment_method      varchar(50),
    pg_order_id         varchar(255),
    pg_transaction_id   varchar(255),
    payment_amount      bigint      NOT NULL,
    payment_status      varchar(50) NOT NULL,
    discount_type       varchar(50),
    discount_amount     bigint,
    CONSTRAINT "PK_PAYMENT" PRIMARY KEY (seq),
    CONSTRAINT "FK_ticketing_order_TO_payment_1" FOREIGN KEY (ticketing_order_seq) REFERENCES ticketing_order(seq)
);
COMMENT ON COLUMN payment.payment_status IS 'PENDING, IN_PROGRESS, COMPLETED, FAILED, CANCELLED';
