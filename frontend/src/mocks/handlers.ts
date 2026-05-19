import { http, HttpResponse } from "msw";

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
  // 유저
  http.get("/users/me", () => {
    return HttpResponse.json(mockUser);
  }),

  // 공연 목록
  http.get("/concerts", () => {
    return HttpResponse.json(mockConcerts);
  }),

  // 공연 상세
  http.get("/concerts/:concertId", ({ params }) => {
    const concert = mockConcerts.find((c) => c.id === Number(params.concertId));
    if (!concert) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(concert);
  }),

  // 좌석 목록
  http.get("/concerts/:concertId/seats", () => {
    return HttpResponse.json(mockSeats);
  }),

  // 티켓 결제
  http.post("/concerts/:concertId/seats/:seatId/bookings", () => {
    return HttpResponse.json({ bookingId: 1, status: "CONFIRMED" }, { status: 201 });
  }),

  // 내 예매 목록
  http.get("/users/me/bookings", () => {
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
  http.post("/bookings/:bookingId/refund", () => {
    return HttpResponse.json({ status: "REFUNDED" });
  }),

  // 호스트 - 내 공연 목록
  http.get("/host/concerts", () => {
    return HttpResponse.json(mockConcerts);
  }),

  // 호스트 - 공연 등록
  http.post("/host/concerts", () => {
    return HttpResponse.json({ id: 3 }, { status: 201 });
  }),

  // 호스트 - 공연 수정
  http.put("/host/concerts/:concertId", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // 호스트 - 공연 삭제
  http.delete("/host/concerts/:concertId", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // 호스트 - 좌석 판매 현황
  http.get("/host/concerts/:concertId/sales", () => {
    return HttpResponse.json({ totalSeats: 5, soldSeats: 1, revenue: 132000 });
  }),
];
