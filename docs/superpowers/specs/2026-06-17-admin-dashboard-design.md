# Admin Dashboard 설계 (User / Venue / Event 관리)

- 날짜: 2026-06-17
- 브랜치: feat/admin
- 범위: 프론트 중심 + 최소 백엔드. User / Venue / Event 관리 화면을 한 번에 구축.

## 1. 목표 / 비목표

### 목표
- 관리자(ADMIN)가 한 곳에서 User / Venue / Event 를 관리하는 대시보드.
- 전용 `/admin` 영역 + role 기반 접근 제어.
- User 관리: 목록 조회 + 검색/페이지네이션, 상세 보기, soft delete.
- Venue 관리: 풀 CRUD (기존 API 재사용).
- Event 관리: 목록/검색, 상세, 수정, 삭제 (기존 API 재사용).
- 개요(Overview) 대시보드: User/Venue/Event 총 개수 표시.

### 비목표 (이번 범위 제외)
- User 권한 변경(USER ↔ ADMIN) 기능.
- 통계 전용 API, 감사 로그, soft delete 복구(restore).

> 추가됨(후속 → 본 범위 편입): Event 서버 검색(`GET /events?keyword=`), Event 생성 화면.

## 2. 코드베이스 기준 사실 (설계 시점 baseline)

> 참고: 이 절은 **설계 착수 시점**의 상태를 기록한다. 구현 후 실제 상태는 8절(구현 완료/남은 작업) 참고.

### 백엔드 (Spring Boot)
- **Venue**: `/venues` 풀 CRUD 존재, 전부 `@PreAuthorize("hasRole('ADMIN')")`. (`getOne` 제외)
- **Event**: `/events` CRUD 존재.
  - 목록(`GET /events`)은 컨트롤러에 `@PreAuthorize`가 **없을 뿐, 공개가 아니다.** `SecurityConfig`의 `anyRequest().authenticated()` 때문에 **인증이 필요**하다. (메인의 공개 공연 목록 의도와 충돌 가능 — 별도 검토 필요, 본 admin 범위 밖)
  - 수정/삭제는 `@eventSecurity.isOwner(#eventId) or hasRole('ADMIN')`.
- **User**: `/users/me` 만 존재. **admin 엔드포인트 없음**.
  - `User` 엔티티에 `role`(USER/ADMIN), `deletedAt`(soft delete), `delete()` 메서드 이미 존재.
  - `UserInfoResponse` 는 email/nickname/profileImage 만 반환 → **role 없음**.
  - `UserRepository` 는 `findByProviderAndProviderId` 만 있음 (JpaRepository 의 `findAll(Pageable)` 사용 가능).

### 프론트엔드 (Next.js App Router + Tailwind + zustand + axios + MSW)
- 라우트 그룹 `(auth)`, `(main)` 존재. `(admin)` 또는 `/admin` 없음.
- `authStore` 는 email/nickname/profileImage 만 저장 → **role 없음** (가드 불가).
- `lib/axios.ts` `apiClient` 가 JWT 부착 + 401 refresh 인터셉터 처리.

## 3. 접근 방식

선택: **전용 `/admin` 영역 + role 가드 + 최소 백엔드.**
- 분리가 깔끔하고 백엔드 추가가 가장 적음.
- 개요 카운트는 각 목록 API의 `totalElements` 로 가져옴 (카운트 전용 API 미생성).

대안(B: 기존 (main) 레이아웃에 끼워넣기), (C: 풀 플랫폼 admin)은 분리/범위 이유로 제외.

## 4. 백엔드 변경 (최소)

### 4.1 role 노출 (가드 근거)
- `UserInfoResponse` 에 `role` 필드 추가.
- `UserService.getMyInfo` 가 `user.getRole()` 를 함께 반환.

### 4.2 AdminUserController (신규, `/admin/users`, 전부 `hasRole('ADMIN')`)
- `GET /admin/users` — `Pageable` + 선택적 `keyword`(이메일 또는 닉네임 contains). **목록은 `deletedAt IS NULL` 만** 노출.
- `GET /admin/users/{seq}` — 상세.
  - **정책 확정**: 관리자 상세는 **삭제된 사용자도 조회 허용**한다(`deletedAt` 필드를 응답에 포함해 삭제 여부/시각을 보여줌). 목록에서는 빠지지만 상세 URL 직접 접근은 가능 → 404 아님.
- `DELETE /admin/users/{seq}` — soft delete (`user.delete()`).
  - **정책 확정**: **멱등**. 이미 삭제된 사용자면 `deletedAt` 을 **재갱신하지 않고** 그대로 204 반환(최초 삭제 시각 보존). 존재하지 않는 seq 는 현재 코드 컨벤션대로 `RuntimeException`(전역 핸들러가 없으면 500) — 의미상 404 가 맞으나 예외→상태코드 매핑은 프로젝트 공통 과제로 둔다.

### 4.3 신규 DTO
- `AdminUserListResponse`: seq, email, nickname, role, provider, createdAt.
- `AdminUserDetailResponse`: 위 + phone, birthday, profileImage, updatedAt, deletedAt.

### 4.4 Repository / Service
- `UserRepository`: 검색 + 삭제 제외 페이징 메서드
  (예: `Page<User> findByDeletedAtIsNullAndKeyword(...)` — JPQL 또는
  `findByDeletedAtIsNullAndEmailContainingIgnoreCaseOrDeletedAtIsNullAndNicknameContainingIgnoreCase` /
  `@Query` 로 keyword null 허용 처리).
- `UserService`: `getUsers(keyword, pageable)`, `getUserDetail(seq)`, `deleteUser(seq)`.

### 4.5 Venue / Event
- Event 는 **백엔드 변경 없이** 기존 `/events` 사용.
- **Venue = soft delete 로 전환 (구현됨).** `Venue` 엔티티에 `deletedAt`/`isDeleted()`/`delete()` 추가.
  - 목록(`getList`)·조회(`getOne`)·수정(`update`) 는 **삭제되지 않은 공연장만** 대상(`findAllByDeletedAtIsNull`, `findBySeqAndDeletedAtIsNull`).
  - **삭제 가드**: `VenueService.delete` 는 `EventRepository.existsByVenue_SeqAndDeletedDateIsNull(seq)` 로 **연결된 활성 Event 존재 시 `409 CONFLICT`(ResponseStatusException)** 로 거부하고, 없으면 `venue.delete()`(soft delete).
  - soft delete 덕분에 과거 Event 가 참조하던 Venue 행은 보존되어 `EventResponse.venueName` 등 기존 참조가 깨지지 않는다.
- **Event 검색 = 서버 검색 (구현됨).** `GET /events?keyword=` 에 제목 부분일치(대소문자 무시) 검색 추가. `EventService.getList(keyword, pageable)` 가 keyword null/blank 면 `findAllByDeletedDateIsNull`, 있으면 `searchActiveEvents`(미삭제 + 제목 LIKE)로 분기(User 검색과 동일한 null-safe 패턴). 기존 비-admin 호출은 keyword 미전달이라 영향 없음.
- **Event 생성 = `POST /events` 재사용 (구현됨).** 컨트롤러가 인증 주체를 host 로 설정하므로 admin 이 생성하면 **host = 현재 관리자**. 별도 host 선택 UI 는 두지 않음(후속 여지).

## 5. 프론트엔드 구조

```
app/admin/layout.tsx            # 사이드바 셸 + AdminGuard
app/admin/page.tsx              # 개요 (스탯 카드: user/venue/event 수)
app/admin/users/page.tsx        # 목록 + 검색 + 페이지네이션 + 삭제
app/admin/users/[seq]/page.tsx  # 상세
app/admin/venues/page.tsx       # 목록 + 생성/수정(모달) + 삭제
app/admin/events/page.tsx       # 목록 + 보기 + 수정 + 삭제

components/admin/
  Sidebar.tsx        # User/Venue/Event/개요 네비
  AdminGuard.tsx     # role !== ADMIN 이면 리다이렉트
  DataTable.tsx      # 재사용 테이블 (컬럼 정의 + 행 액션)
  Pagination.tsx     # 페이지 이동
  SearchBar.tsx      # keyword 입력 (debounce)
  ConfirmDialog.tsx  # 삭제 확인 모달
  StatCard.tsx       # 개요 카운트 카드

lib/api/
  adminUsers.ts      # listUsers, getUser, deleteUser
  venues.ts          # listVenues, getVenue, createVenue, updateVenue, deleteVenue
  events.ts          # listEvents, getEvent, updateEvent, deleteEvent
```

### 5.1 접근 제어 (이중)
- 프론트 `AdminGuard`: 마운트 시 `/users/me` 로 role 갱신 → ADMIN 아니면 리다이렉트(예: `/`).
- 백엔드 `@PreAuthorize`: 실제 강제. (가드는 UX, 보안은 백엔드)
- `authStore.User` 에 `role` 추가. 로그인/me 조회 시 저장.

### 5.2 개요(Overview)
- 각 목록 API 를 `size=1` 로 호출 → `totalElements` 만 사용해 카운트 표시.

### 5.3 Venue 관리
- 풀 CRUD. 생성/수정은 모달 폼 (name/address/description/venueImage).
- 삭제는 soft delete(4.5). 연결된 활성 Event 가 있으면 백엔드가 `409` → UI 는 "연결된 이벤트가 있어 삭제할 수 없습니다" 배너로 안내(그 외 실패는 일반 메시지).
- 공연장별 "좌석맵 편집" 링크 → 기존 seatmap 스튜디오(선택적, 시간 되면).

### 5.4 Event 관리
- 목록/검색/생성/수정(`PUT /events/{eventId}`)/삭제.
- 검색은 **서버 검색**(4.5) — 검색창 제출 시 `keyword` 로 재조회(페이지 0 리셋).
- 생성/수정은 동일한 `EventFormModal`(공연장 select, 일시 입력) 재사용. `event` prop 이 null 이면 생성(`POST /events`), 있으면 수정.

## 6. 데이터 흐름 & 에러 처리
- 모든 호출은 기존 `apiClient`. 401 은 인터셉터가 refresh.
- 403 → 가드가 보통 방지, 폴백 "권한 없음" 메시지.
- 변경 작업(삭제/수정) → `ConfirmDialog` 확인 후 목록 재조회.
- 로딩/빈 상태/에러 상태를 `DataTable` 에서 표준화.

## 7. 테스트
- 백엔드:
  - `AdminUserController` 슬라이스/통합 테스트: 목록, keyword 검색, 상세, soft delete.
  - 인가 테스트: ADMIN 200 / USER 403.
  - soft-delete 후 목록에서 제외 확인.
- 프론트:
  - FE 테스트 셋업 존재 여부 계획 단계에서 확인.
  - 있으면 MSW 목 기반 `DataTable` 렌더/페이지네이션, `AdminGuard` 리다이렉트 테스트.

## 8. 구현 상태 (완료 / 남은 작업)

### 완료 (백엔드)
- `UserInfoResponse` + `UserService.getMyInfo` 에 `role` 추가.
- `AdminUserController` (`/admin/users`, 클래스 레벨 `hasRole('ADMIN')`): 목록(`keyword`)/상세/soft delete.
- `AdminUserListResponse`, `AdminUserDetailResponse` DTO.
- `UserRepository.searchActiveUsers`(`deletedAt IS NULL` + keyword null 허용 `@Query`).
- `UserService.getUsers/getUserDetail/deleteUser`.
- **Venue soft delete 전환**: `Venue.deletedAt`/`isDeleted()`/`delete()`, `VenueRepository.findAllByDeletedAtIsNull`/`findBySeqAndDeletedAtIsNull`, `VenueService` 가 활성 공연장만 다루고 삭제 시 연결 Event 체크(409) 후 soft delete.
- `EventRepository.existsByVenue_SeqAndDeletedDateIsNull` (Venue 삭제 가드용).
- **Event 서버 검색**: `GET /events?keyword=` (제목 부분일치), `EventService.getList(keyword, pageable)` 분기 + `EventRepository.searchActiveEvents`.

### 완료 (프론트)
- `authStore.User` 에 `role` 추가.
- `lib/api/{adminUsers,venues,events}.ts`, `lib/api/types.ts`(Page/PageParams), `lib/format.ts`.
- `app/admin/layout.tsx` + `AdminGuard`, `Sidebar`.
- 공통 컴포넌트: `DataTable`, `Pagination`, `SearchBar`, `ConfirmDialog`, `StatCard`.
- 화면: 개요(`page.tsx`), User(목록/상세), Venue(CRUD + `VenueFormModal`), Event(목록/검색/생성·수정 `EventFormModal`/삭제).
- `EventFormModal`: 생성·수정 공용(공연장 select, 일시 입력). `lib/api/events.ts` 에 `createEvent`/`listEvents(keyword)` 추가.
- (별건) MSW 를 `NEXT_PUBLIC_API_MOCKING=enabled` 플래그(`npm run dev:mock`)로만 가동하도록 변경.

### 완료 (피드백 반영)
- `UserService.deleteUser` 멱등 보강(이미 삭제 시 `deletedAt` 재갱신 방지) — 4.2 정책.
- Venue soft delete 전환 + 삭제 시 연결 Event 체크(409) — 4.5 정책.
- `EventService.findVenue` 가 활성 Venue(`findBySeqAndDeletedAtIsNull`)만 연결하도록 보강 — soft-deleted Venue 참조 방지.
- Event 검색을 서버 검색(`GET /events?keyword=`)으로 전환, 클라이언트 페이지 필터 제거.
- Event 생성 화면(`POST /events`, host = 현재 관리자) 추가.

### 남은 작업
- 백엔드 테스트: `AdminUserController` / `VenueService` 인가·CRUD·삭제 가드 테스트. 단, **현재 테스트 인프라가 막혀 있음**(7절/주의 — `podoR-config` 테스트 yml의 중복 키, H2 의존성 부재). 인프라 정상화 후 작성.

## 9. 후속 작업 (이번 범위 밖)
- Event 생성 시 host 선택 UI (현재는 생성한 관리자가 host 로 고정).
- User 권한 변경(USER ↔ ADMIN).
- User/Venue soft delete 복구(restore).
- 통계 전용 API.
- 백엔드 테스트 인프라 정상화(podoR-config 테스트 yml 중복 키 제거, H2 의존성 추가).
