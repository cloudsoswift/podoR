# Admin Dashboard 설계 (User / Venue / Event 관리)

- 날짜: 2026-06-17
- 브랜치: feat/event
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
- Event 생성 화면 (host + venue 선택 흐름 필요 → 후속 작업).
- 통계 전용 API, 감사 로그, soft delete 복구(restore).

## 2. 현재 코드베이스 기준 사실

### 백엔드 (Spring Boot)
- **Venue**: `/venues` 풀 CRUD 존재, 전부 `@PreAuthorize("hasRole('ADMIN')")`. (`getOne` 제외)
- **Event**: `/events` CRUD 존재. 목록은 공개, 수정/삭제는 `@eventSecurity.isOwner(#eventId) or hasRole('ADMIN')`.
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
- `GET /admin/users` — `Pageable` + 선택적 `keyword`(이메일 또는 닉네임 contains). 기본적으로 `deletedAt IS NULL` 만.
- `GET /admin/users/{seq}` — 상세.
- `DELETE /admin/users/{seq}` — soft delete (`user.delete()`). 이미 삭제된 경우 멱등 처리 또는 404.

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
- **백엔드 변경 없음.** 기존 `/venues`, `/events` 사용.
- Event 목록 검색이 필요하면 클라이언트 측 필터로 우선 처리 (서버 검색 파라미터는 후속).

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
- 공연장별 "좌석맵 편집" 링크 → 기존 seatmap 스튜디오(선택적, 시간 되면).

### 5.4 Event 관리
- 목록/검색(클라이언트 필터), 상세, 수정(`PUT /events/{eventId}`), 삭제.
- 생성은 범위 제외.

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

## 8. 구현 순서(권장)
1. 백엔드: `UserInfoResponse` role 추가 → AdminUserController + DTO + Repository/Service + 테스트.
2. 프론트 공통: `authStore` role, `AdminGuard`, 레이아웃/사이드바, 공통 컴포넌트, `lib/api`.
3. User 관리 화면 (목록/검색/페이지네이션/상세/삭제).
4. Venue 관리 화면 (CRUD).
5. Event 관리 화면 (목록/상세/수정/삭제).
6. 개요 대시보드 (카운트).

## 9. 후속 작업 (이번 범위 밖)
- Event 생성 화면(host/venue 선택).
- User 권한 변경.
- soft delete 복구.
- 서버사이드 Event/Venue 검색 파라미터.
- 통계 전용 API.
