import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import { useAuthStore } from "@/store/authStore";
import RoleGuard from "../RoleGuard";

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

function me(role: string) {
  server.use(
    http.get(`${BASE_URL}/users/me`, () =>
      HttpResponse.json({ email: "a@t.com", nickname: "a", profileImage: null, role }),
    ),
  );
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: "token", user: null });
});

test("HOST_는_HOST_페이지를_본다", async () => {
  me("HOST");
  render(
    <RoleGuard roles={["HOST", "ADMIN"]}>
      <p>호스트 화면</p>
    </RoleGuard>,
  );
  expect(await screen.findByText("호스트 화면")).toBeInTheDocument();
});

test("USER_는_거부_문구", async () => {
  me("USER");
  render(
    <RoleGuard roles={["HOST", "ADMIN"]}>
      <p>호스트 화면</p>
    </RoleGuard>,
  );
  expect(await screen.findByText("HOST·ADMIN만 이용할 수 있는 페이지입니다.")).toBeInTheDocument();
  expect(screen.queryByText("호스트 화면")).not.toBeInTheDocument();
});
