import { render, waitFor } from "@testing-library/react";
import { useAuthStore } from "@/store/authStore";
import OAuth2RedirectPage from "../page";

const mockReplace = jest.fn();
const mockPush = jest.fn();
// 실제 Next 의 useRouter 처럼 매 렌더 같은 객체를 돌려줘야 한다. 페이지 effect 의 의존성에 router 가 있어서,
// 렌더마다 새 객체를 주면 effect → setAccessToken → 리렌더 → effect … 무한 반복된다.
const mockRouter = { replace: mockReplace, push: mockPush };
let mockSearch = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearch,
}));

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().clearAuth();
});

test("로그인 전에 있던 페이지로 replace 한다", async () => {
  mockSearch = new URLSearchParams("accessToken=T&redirect=%2Fevents%2FE1%2Fseats");

  render(<OAuth2RedirectPage />);

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/events/E1/seats"));
  expect(useAuthStore.getState().accessToken).toBe("T");
});

test("redirect 가 안전하지 않으면 홈으로 보낸다 — 이 URL 은 누구나 조립할 수 있다", async () => {
  mockSearch = new URLSearchParams("accessToken=T&redirect=%2F%2Fevil.com");

  render(<OAuth2RedirectPage />);

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
});

test("redirect 가 없으면 홈으로 보낸다", async () => {
  mockSearch = new URLSearchParams("accessToken=T");

  render(<OAuth2RedirectPage />);

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
});
