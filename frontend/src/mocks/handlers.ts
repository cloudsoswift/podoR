import { http, HttpResponse } from "msw";

// apiClient(baseURL)와 동일하게 맞춰야 요청이 매칭됨.
// MSW는 상대경로를 location.origin(:3000)에 붙여 해석하므로,
// :8080으로 나가는 apiClient 요청을 잡으려면 절대 URL prefix가 필요하다.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const mockUser = {
  email: "test@test.com",
  nickname: "테스트유저",
  profileImage: null,
};

const mockConcerts = [
  {
    id: 1,
    title: "아이유 콘서트 2026",
    hostNickname: "아이유",
    venue: "올림픽공원 KSPO돔",
    startAt: "2026-08-01T19:00:00",
    posterImage: null,
    genre: "POP",
    minPrice: 99000,
  },
  {
    id: 2,
    title: "BTS World Tour",
    hostNickname: "BIGHIT",
    venue: "잠실종합운동장",
    startAt: "2026-09-15T18:00:00",
    posterImage: null,
    genre: "POP",
    minPrice: 132000,
  },
];

const mockSeats = [
  { id: 1, section: "A", row: 1, number: 1, price: 132000, status: "AVAILABLE" },
  { id: 2, section: "A", row: 1, number: 2, price: 132000, status: "TAKEN" },
  { id: 3, section: "A", row: 1, number: 3, price: 132000, status: "AVAILABLE" },
  { id: 4, section: "B", row: 1, number: 1, price: 99000, status: "AVAILABLE" },
  { id: 5, section: "B", row: 1, number: 2, price: 99000, status: "AVAILABLE" },
];

export const handlers = [
  // 인증 - 토큰 갱신
  http.post(`${BASE_URL}/oauth2/token/refresh`, () => {
    return HttpResponse.json({ accessToken: "mock-access-token" });
  }),

  // 인증 - 로그아웃
  http.post(`${BASE_URL}/oauth2/logout`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // 유저
  http.get(`${BASE_URL}/users/me`, () => {
    return HttpResponse.json(mockUser);
  }),

  // 공연 목록
  http.get(`${BASE_URL}/concerts`, () => {
    return HttpResponse.json(mockConcerts);
  }),

  // 공연 상세
  http.get(`${BASE_URL}/concerts/:concertId`, ({ params }) => {
    const concert = mockConcerts.find((c) => c.id === Number(params.concertId));
    if (!concert) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(concert);
  }),

  // 좌석 목록
  http.get(`${BASE_URL}/concerts/:concertId/seats`, () => {
    return HttpResponse.json(mockSeats);
  }),

  // 티켓 결제
  http.post(`${BASE_URL}/concerts/:concertId/seats/:seatId/bookings`, () => {
    return HttpResponse.json({ bookingId: 1, status: "CONFIRMED" }, { status: 201 });
  }),

  // 내 예매 목록
  http.get(`${BASE_URL}/users/me/bookings`, () => {
    return HttpResponse.json([
      {
        bookingId: 1,
        concertTitle: "아이유 콘서트 2026",
        startAt: "2026-08-01T19:00:00",
        seat: { section: "A", row: 1, number: 1 },
        price: 132000,
        status: "CONFIRMED",
      },
    ]);
  }),

  // 티켓 환불
  http.post(`${BASE_URL}/bookings/:bookingId/refund`, () => {
    return HttpResponse.json({ status: "REFUNDED" });
  }),

  // 호스트 - 내 공연 목록
  http.get(`${BASE_URL}/host/concerts`, () => {
    return HttpResponse.json(mockConcerts);
  }),

  // 호스트 - 공연 등록
  http.post(`${BASE_URL}/host/concerts`, () => {
    return HttpResponse.json({ id: 3 }, { status: 201 });
  }),

  // 호스트 - 공연 수정
  http.put(`${BASE_URL}/host/concerts/:concertId`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // 호스트 - 공연 삭제
  http.delete(`${BASE_URL}/host/concerts/:concertId`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // 호스트 - 좌석 판매 현황
  http.get(`${BASE_URL}/host/concerts/:concertId/sales`, () => {
    return HttpResponse.json({ totalSeats: 5, soldSeats: 1, revenue: 132000 });
  }),
];
