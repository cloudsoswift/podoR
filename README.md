# podoR(포도알)
## GOAL
- Next.js(FE)와 Spring Boot(BE)로 이루어진 티켓팅 서비스
- HLS, RTMP 등 미디어 처리, 그리고 티켓팅시 발생하는 동시 요청을 효율적으로 처리할 수 있는 방법을 학습하기 위한 프로젝트
## 대략적인 구상
### 아키텍처 (Claude Generated)
┌─────────────────────────────────────────────────────────┐
│                    클라이언트                           │
│                    (Next.js)                            │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│          API Gateway / Load Balancer                    │
└─────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────┐          ┌──────────────────────┐
│  Spring Boot     │          │  Nginx-RTMP Cluster  │
│  (인증/비즈니스) │◄────────►│  (미디어 처리)       │
└──────────────────┘   HTTP   └──────────────────────┘
           │              Callback            │
           │                                  │
           ▼                                  ▼
┌──────────────────┐          ┌──────────────────────┐
│     Redis        │◄────────►│    Shared Redis      │
│  (세션, 캐시)    │          │  (스트림 키, 상태)   │
└──────────────────┘          └──────────────────────┘
           │
           ▼
┌──────────────────┐
│   PostgreSQL     │
│  (영구 데이터)   │
└──────────────────┘
- 사용자의 RTMP 요청 처리는 별도의 node.js 서버, 또는 Jaffree와 같은 Java 라이브러리로 변경할 수도 있음
### 사용할 기술 스택/의존성과 선택 이유
#### 프론트엔드
- React.js
- Next.js
- React-Query
- Zustand
- Emotion
- MSW
- Jest
- Typescript
#### 백엔드
- Spring
- redis
- nginx
- postgresql (or oracle)
### 개발 스텝
1. 기능 설계 및 React.js/Next.js를 사용한 화면 개발
2. Spring 서버 구축 및 인증/인가에 필요한 기능 설계, 구현
3. RTMP/HLS Request/Response 핸들링하는 서버 구현
4. RTMP/HLS Request/Response 처리시 인증/인가 정보 사용하도록 확장
5. 티켓팅 서비스 구현
6. Locust 등 부하 테스트 진행하며 동시 요청 처리 성능 확장 시키기
7. 백엔드 서비스들 Microservices로 쪼갠 뒤, Redis를 통해 인증/인가 정보 공유하도록 확장
## 서비스 기능
### 공통
- 회원가입 / 로그인
- 팔로잉
- 공연 목록 조회
- 공연 정보 조회
### 공연 주최자 관련
- 콘서트 등록/수정/삭제(CUD)
- 좌석 구매 현황 조회
- 라이브 공연 영상 업로드
### 공연 소비자 관련
- 공연 좌석 조회
- 공연 좌석 선택
- 공연 티켓 결제
- 구매한 공연 티켓 조회
- 구매한 공연 티켓 환불
- 라이브 공연 영상 요청 (공연 관람)

## 개발 계획 (상세)

### 현재 진행 상황 (2026-05-19 기준)
**완료**
- FE: 전체 페이지 라우트 구조 (`/concerts`, `/host`, `/mypage`, `/auth` 등)
- FE: Zustand 인증 상태 관리, axios 인터셉터
- FE: 홈 화면 컴포넌트 (MainBanner, MiniBannerCards, GenreRanking, DealsSection)
- BE: JWT + OAuth2 (Google, Kakao) 인증/인가 구조
- BE: User, Performance, Seat, Ticketing, Follow 도메인 엔티티 설계

**미구현**
- 대부분의 페이지 라우트만 존재, 실제 UI 미구현
- BE Concert/Performance CRUD API
- FE-BE 실제 연결 (OAuth2 리다이렉트 제외)

---

### ~~Phase 1 — 인증 플로우 완성~~
- OAuth2 리다이렉트 → 토큰 저장 → `/me` 유저 정보 조회까지 E2E 연결
- 토큰 갱신(refresh) 로직을 axios 인터셉터에 연결
- 로그인/로그아웃 UI 완성

### Phase 2 — 공연 도메인 (FE + BE 병행)
- **MSW 핸들러 먼저 작성** → BE 없이 FE 개발 가능
- BE: `Performance`, `ConcertHall`, `Seat` CRUD API
- FE: 공연 목록/상세, 호스트 공연 등록/수정 페이지
- **React-Query 도입** (서버 상태 캐싱/로딩 관리)

### Phase 3 — 티켓팅 (핵심, 가장 복잡)
- 동시성 처리 전략 결정: Redis SETNX / Redisson 분산 락 / Kafka 대기열 중 선택
- BE: Redis 기반 좌석 점유 → 결제 완료 → DB 확정 플로우
- FE: 좌석 선택 → 결제 UI (실시간 좌석 상태: SSE 또는 WebSocket)

### Phase 4 — 스트리밍
- Nginx-RTMP 서버 구성
- BE: 스트림 키 발급/검증 API
- FE: hls.js 기반 HLS 플레이어

### Phase 5 — 부하 테스트 & MSA 전환
- Locust로 티켓팅 동시 요청 시나리오 테스트
- 병목 확인 후 MSA 분리 여부 결정
- Redis를 통한 서비스 간 인증/인가 정보 공유

---

### 핵심 결정 사항
1. **MSW 세팅 시점**: Phase 2 시작 전 → FE/BE 병행 개발 가능
2. **티켓팅 동시성 전략**: Phase 3 시작 전 목표 동시 사용자 수 정의 후 결정
3. **React-Query 도입 시점**: Phase 2부터 (공연 목록/상세 등 서버 데이터 다루는 페이지부터)