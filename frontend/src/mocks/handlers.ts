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

const mockVenues = [
  {
    seq: 1,
    name: "올림픽공원 KSPO돔",
    address: "서울특별시 송파구 올림픽로 424",
    description: "국내 최대 규모의 실내 공연장으로, 약 15,000석 규모를 보유하고 있습니다.",
    venueImage: null,
    createdAt: "2024-01-01T00:00:00",
    updatedAt: "2024-01-01T00:00:00",
  },
  {
    seq: 2,
    name: "잠실종합운동장",
    address: "서울특별시 송파구 올림픽로 25",
    description: "서울을 대표하는 대형 야외 공연장입니다.",
    venueImage: null,
    createdAt: "2024-01-01T00:00:00",
    updatedAt: "2024-01-01T00:00:00",
  },
];

const mockEvents = [
  {
    seq: 1,
    venueSeq: 1,
    eventId: "event-uuid-0001",
    title: "아이유 콘서트 2026",
    hostNickname: "아이유",
    eventDate: "2026-08-01T19:00:00",
    eventType: "POP",
    streamStatus: "SCHEDULED",
  },
  {
    seq: 2,
    venueSeq: 2,
    eventId: "event-uuid-0002",
    title: "BTS World Tour",
    hostNickname: "BIGHIT",
    eventDate: "2026-09-15T18:00:00",
    eventType: "POP",
    streamStatus: "SCHEDULED",
  },
  {
    seq: 3,
    venueSeq: 1,
    eventId: "event-uuid-0003",
    title: "아이유 콘서트 2025",
    hostNickname: "아이유",
    eventDate: "2025-12-24T19:00:00",
    eventType: "POP",
    streamStatus: "ENDED",
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

  // 이벤트 목록
  http.get(`${BASE_URL}/events`, () => {
    return HttpResponse.json(mockEvents);
  }),

  // 이벤트 상세
  http.get(`${BASE_URL}/events/:eventId`, ({ params }) => {
    const event = mockEvents.find((e) => e.eventId === params.eventId);
    if (!event) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(event);
  }),

  // 좌석 목록
  http.get(`${BASE_URL}/events/:eventId/seats`, () => {
    return HttpResponse.json(mockSeats);
  }),

  // 티켓 결제
  http.post(`${BASE_URL}/events/:eventId/seats/:seatId/bookings`, () => {
    return HttpResponse.json({ bookingId: 1, status: "CONFIRMED" }, { status: 201 });
  }),

  // 내 예매 목록
  http.get(`${BASE_URL}/users/me/bookings`, () => {
    return HttpResponse.json([
      {
        bookingId: 1,
        eventTitle: "아이유 콘서트 2026",
        eventDate: "2026-08-01T19:00:00",
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

  // 호스트 - 내 이벤트 목록
  http.get(`${BASE_URL}/host/events`, () => {
    return HttpResponse.json(mockEvents);
  }),

  // 호스트 - 이벤트 등록
  http.post(`${BASE_URL}/host/events`, () => {
    return HttpResponse.json({ seq: 4 }, { status: 201 });
  }),

  // 호스트 - 이벤트 수정
  http.put(`${BASE_URL}/host/events/:eventId`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // 호스트 - 이벤트 삭제
  http.delete(`${BASE_URL}/host/events/:eventId`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // 호스트 - 좌석 판매 현황
  http.get(`${BASE_URL}/host/events/:eventId/sales`, () => {
    return HttpResponse.json({ totalSeats: 5, soldSeats: 1, revenue: 132000 });
  }),

  // 공연장 상세
  http.get(`${BASE_URL}/venues/:venueId`, ({ params }) => {
    const venue = mockVenues.find((v) => v.seq === Number(params.venueId));
    if (!venue) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(venue);
  }),

  // 공연장의 이벤트 목록 (최신순)
  http.get(`${BASE_URL}/venues/:venueId/events`, ({ params }) => {
    const events = mockEvents
      .filter((e) => e.venueSeq === Number(params.venueId))
      .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
    return HttpResponse.json(events);
  }),
];
