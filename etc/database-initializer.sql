-- 테이블 생성
CREATE TABLE "performance" (
	"seq"	BIGSERIAL		NOT NULL,
	"performer_seq"	BIGINT		NOT NULL,
	"performance_id"	VARCHAR(255)		NOT NULL,
	"title"	VARCHAR(255)		NOT NULL,
	"content"	TEXT		NULL,
	"created_date"	TIMESTAMP		NOT NULL,    
	"deleted_date"	TIMESTAMP		NULL,
	"perform_date"	TIMESTAMP		NOT NULL,
	"ticketing_date"	TIMESTAMP		NOT NULL
);

COMMENT ON COLUMN "performance"."performance_id" IS 'UUID 형태의 공연 식별자';

CREATE TABLE "performance_seat" (
	"seq"	BIGSERIAL		NOT NULL,
	"performance_seq"	BIGINT		NOT NULL,
	"seat_seq"	BIGINT		NOT NULL,
	"seat_grade"	VARCHAR(10)		NOT NULL,
	"price"	INTEGER		NOT NULL,
	"status"	BOOLEAN	DEFAULT FALSE	NOT NULL
);

CREATE TABLE "ticketing_order" (
	"seq"	BIGSERIAL		NOT NULL,
	"performance_seq"	BIGINT		NOT NULL,
	"user_seq"	BIGINT		NOT NULL,
	"order_number"	VARCHAR(100)		NOT NULL,
	"total_price"	INTEGER		NOT NULL,
	"status"	VARCHAR(20)		NOT NULL,
	"ordered_at"	TIMESTAMP	DEFAULT CURRENT_TIMESTAMP	NOT NULL,
	"cancelled_at"	TIMESTAMP		NULL
);

COMMENT ON COLUMN "ticketing_order"."order_number" IS 'UNIQUE';

CREATE TABLE "ticketing_item" (
	"seq"	BIGSERIAL		NOT NULL,
	"ticketing_order_seq"	BIGINT		NOT NULL,
	"performance_seat_seq"	BIGINT		NOT NULL
);

CREATE TABLE "user" (
	"seq"	BIGSERIAL		NOT NULL,
	"email"	VARCHAR(255)		NOT NULL,
	"nickname"	VARCHAR(100)		NOT NULL,
	"provider"	VARCHAR(20)		NOT NULL,
	"provider_id"	VARCHAR(255)		NOT NULL,
	"role"	VARCHAR(50)	DEFAULT 'USER'	NOT NULL,
	"phone"	VARCHAR(50)		NULL,
	"birthday"	DATE		NULL,
	"profile_image"	VARCHAR(500)		NULL,
	"created_at"	TIMESTAMP	DEFAULT CURRENT_TIMESTAMP	NOT NULL,
	"updated_at"	TIMESTAMP	DEFAULT CURRENT_TIMESTAMP	NOT NULL
);

COMMENT ON COLUMN "user"."provider" IS '''GOOGLE'', ''KAKAO''';

COMMENT ON COLUMN "user"."provider_id" IS 'OAuth 제공자 고유의 ID';

COMMENT ON COLUMN "user"."role" IS '''USER'', ''ADMIN''';

COMMENT ON COLUMN "user"."profile_image" IS 'Profile 이미지 URL';

CREATE TABLE "seat" (
	"seq"	BIGSERIAL		NOT NULL,
	"hall_seq"	BIGINT		NOT NULL,
	"section"	VARCHAR(20)		NOT NULL,
	"row_number"	VARCHAR(10)		NOT NULL,
	"seat_number"	INTEGER		NULL,
	"is_available"	BOOLEAN	DEFAULT TRUE	NOT NULL
);

CREATE TABLE "concert_hall" (
	"seq"	BIGSERIAL		NOT NULL,
	"name"	VARCHAR(255)		NOT NULL,
	"address"	VARCHAR(1000)		NOT NULL,
	"description"	TEXT		NULL,
	"concert_hall_image"	VARCHAR(500)		NULL,
	"created_at"	TIMESTAMP	DEFAULT CURRENT_TIMESTAMP	NOT NULL,
	"updated_at"	TIMESTAMP	DEFAULT CURRENT_TIMESTAMP	NOT NULL
);

CREATE TABLE "payment" (
	"seq"	BIGSERIAL		NOT NULL,
	"ticketing_order_seq"	BIGINT		NOT NULL,
	"payment_method"	VARCHAR(50)		NULL,
	"pg_order_id"	VARCHAR(255)		NULL,
	"pg_transaction_id"	VARCHAR(255)		NULL,
	"payment_amount"	BIGINT		NOT NULL,
	"payment_status"	VARCHAR(50)		NOT NULL,
	"discount_type"	VARCHAR(50)		NULL,
	"discount_amount"	BIGINT		NULL
);

COMMENT ON COLUMN "payment"."payment_status" IS '''PENDING'', ''IN_PROGRESS'', ''COMPLETED'', ''FAILED'', ''CANCELLED''';

CREATE TABLE "follow" (
	"follower_seq"	BIGINT		NOT NULL,
	"performer_seq"	BIGINT		NOT NULL,
	"followed_at"	TIMESTAMP		NOT NULL
);

-- PK 설정
ALTER TABLE "performance" ADD CONSTRAINT "PK_PERFORMANCE" PRIMARY KEY (
	"seq"
);

ALTER TABLE "performance_seat" ADD CONSTRAINT "PK_PERFORMANCE_SEAT" PRIMARY KEY (
	"seq"
);

ALTER TABLE "ticketing_order" ADD CONSTRAINT "PK_TICKETING_ORDER" PRIMARY KEY (
	"seq"
);

ALTER TABLE "ticketing_item" ADD CONSTRAINT "PK_TICKETING_ITEM" PRIMARY KEY (
	"seq"
);

ALTER TABLE "user" ADD CONSTRAINT "PK_USER" PRIMARY KEY (
	"seq"
);

ALTER TABLE "seat" ADD CONSTRAINT "PK_SEAT" PRIMARY KEY (
	"seq"
);

ALTER TABLE "concert_hall" ADD CONSTRAINT "PK_CONCERT_HALL" PRIMARY KEY (
	"seq"
);

ALTER TABLE "payment" ADD CONSTRAINT "PK_PAYMENT" PRIMARY KEY (
	"seq"
);

ALTER TABLE "follow" ADD CONSTRAINT "PK_FOLLOW" PRIMARY KEY (
	"follower_seq",
	"performer_seq"
);

-- FK 설정
ALTER TABLE "performance" ADD CONSTRAINT "FK_user_TO_performance_1" FOREIGN KEY (
	"performer_seq"
)
REFERENCES "user" (
	"seq"
);

ALTER TABLE "performance_seat" ADD CONSTRAINT "FK_performance_TO_performance_seat_1" FOREIGN KEY (
	"performance_seq"
)
REFERENCES "performance" (
	"seq"
);

ALTER TABLE "performance_seat" ADD CONSTRAINT "FK_seat_TO_performance_seat_1" FOREIGN KEY (
	"seat_seq"
)
REFERENCES "seat" (
	"seq"
);

ALTER TABLE "ticketing_order" ADD CONSTRAINT "FK_performance_TO_ticketing_order_1" FOREIGN KEY (
	"performance_seq"
)
REFERENCES "performance" (
	"seq"
);

ALTER TABLE "ticketing_order" ADD CONSTRAINT "FK_user_TO_ticketing_order_1" FOREIGN KEY (
	"user_seq"
)
REFERENCES "user" (
	"seq"
);

ALTER TABLE "ticketing_item" ADD CONSTRAINT "FK_ticketing_order_TO_ticketing_item_1" FOREIGN KEY (
	"ticketing_order_seq"
)
REFERENCES "ticketing_order" (
	"seq"
);

ALTER TABLE "ticketing_item" ADD CONSTRAINT "FK_performance_seat_TO_ticketing_item_1" FOREIGN KEY (
	"performance_seat_seq"
)
REFERENCES "performance_seat" (
	"seq"
);

ALTER TABLE "seat" ADD CONSTRAINT "FK_concert_hall_TO_seat_1" FOREIGN KEY (
	"hall_seq"
)
REFERENCES "concert_hall" (
	"seq"
);

ALTER TABLE "payment" ADD CONSTRAINT "FK_ticketing_order_TO_payment_1" FOREIGN KEY (
	"ticketing_order_seq"
)
REFERENCES "ticketing_order" (
	"seq"
);

ALTER TABLE "follow" ADD CONSTRAINT "FK_user_TO_follow_1" FOREIGN KEY (
	"follower_seq"
)
REFERENCES "user" (
	"seq"
);

ALTER TABLE "follow" ADD CONSTRAINT "FK_user_TO_follow_2" FOREIGN KEY (
	"performer_seq"
)
REFERENCES "user" (
	"seq"
);

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
CREATE TRIGGER update_user_updated_at 
    BEFORE UPDATE ON "user"
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_concert_hall_updated_at 
    BEFORE UPDATE ON concert_hall
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- FK 인덱스 (주로 사용될 것으로 예상되는 컬럼들)
CREATE INDEX idx_seat_hall ON seat(hall_seq);
CREATE INDEX idx_performance_performer ON performance(performer_seq);
CREATE INDEX idx_performance_hall ON performance(hall_seq);
CREATE INDEX idx_performance_seat_performance ON performance_seat(performance_seq);
CREATE INDEX idx_performance_seat_seat ON performance_seat(seat_seq);
CREATE INDEX idx_ticketing_order_user ON ticketing_order(user_seq);
CREATE INDEX idx_ticketing_order_performance ON ticketing_order(performance_seq);
CREATE INDEX idx_ticketing_item_order ON ticketing_item(ticketing_order_seq);
CREATE INDEX idx_ticketing_item_seat ON ticketing_item(performance_seat_seq);
CREATE INDEX idx_payment_order ON payment(ticketing_order_seq);
CREATE INDEX idx_follow_follower ON follow(follower_seq);
CREATE INDEX idx_follow_performer ON follow(performer_seq);

-- 스트리밍 관련 컬럼, 공연장 관련 컬럼 추가
alter table "performance" add stream_key VARCHAR(255)   null;             -- RTMP 스트림 키
alter table "performance" add     stream_status      VARCHAR(20)    null;             -- 'SCHEDULED', 'LIVE', 'ENDED'
ALTER TABLE performance ADD COLUMN performance_type VARCHAR(50) NOT NULL; -- 'CONCERT', 'MUSICAL', 'PLAY', 'OPERA', 'DANCE' 등
alter table "performance" add     hall_seq           BIGINT         NOT null;
ALTER TABLE "performance" ADD CONSTRAINT "FK_concert_hall_TO_performance_item_1" FOREIGN KEY (
	"hall_seq"
)
REFERENCES "concert_hall" (
	"seq"
);