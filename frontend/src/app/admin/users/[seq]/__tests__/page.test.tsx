import { Suspense } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import AdminUserDetailPage from "../page";

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

const user = {
  seq: 5,
  email: "u@t.com",
  nickname: "유저",
  role: "USER",
  provider: "KAKAO",
  createdAt: "2026-10-01T10:00:00",
  phone: null,
  birthday: null,
  profileImage: null,
  updatedAt: "2026-10-01T10:00:00",
  deletedAt: null,
};

async function renderPage() {
  const params = Promise.resolve({ seq: "5" });
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <AdminUserDetailPage params={params} />
      </Suspense>,
    );
  });
  await screen.findByRole("heading", { name: "유저" });
}

function stub(status = 204) {
  const bodies: unknown[] = [];
  server.use(
    http.get(`${BASE_URL}/admin/users/5`, () => HttpResponse.json(user)),
    http.patch(`${BASE_URL}/admin/users/5/role`, async ({ request }) => {
      bodies.push(await request.json());
      return new HttpResponse(null, { status });
    }),
  );
  return bodies;
}

test("역할을_HOST_로_바꾸면_PATCH_본문과_안내_문구", async () => {
  const bodies = stub();
  await renderPage();

  await userEvent.selectOptions(screen.getByLabelText("권한"), "HOST");
  await userEvent.click(screen.getByRole("button", { name: "변경" }));

  expect(
    await screen.findByText("변경했습니다. 해당 사용자가 다음에 토큰을 갱신하면(최대 15분) 적용됩니다."),
  ).toBeInTheDocument();
  expect(bodies).toEqual([{ role: "HOST" }]);
});

test("400_이면_자기_해제_안내", async () => {
  stub(400);
  await renderPage();

  await userEvent.selectOptions(screen.getByLabelText("권한"), "HOST");
  await userEvent.click(screen.getByRole("button", { name: "변경" }));

  expect(await screen.findByText("자기 자신의 관리자 권한은 해제할 수 없습니다.")).toBeInTheDocument();
});
