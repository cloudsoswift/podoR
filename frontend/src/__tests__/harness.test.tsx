import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { listVenues } from "@/lib/api/venues";

/**
 * 테스트 하네스 자체의 회귀 가드.
 * 설정(폴리필 순서·export 조건·transformIgnorePatterns 등)이 깨지면 여기서 먼저 실패한다.
 * 배경과 각 설정의 근거는 docs/frontend-test-harness-setup.md 참고.
 */
test("RTL 렌더와 jest-dom 매처가 동작한다", () => {
  render(<button>hello</button>);
  expect(screen.getByRole("button", { name: "hello" })).toBeInTheDocument();
});

test("MSW 가 axios 요청을 가로챈다", async () => {
  server.use(
    http.get("http://localhost:8080/venues", () =>
      HttpResponse.json({
        content: [
          { seq: 1, name: "V", address: "A", description: null, venueImage: null, createdAt: "", updatedAt: "" },
        ],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 1,
        first: true,
        last: true,
      }),
    ),
  );

  const page = await listVenues({ page: 0, size: 1 });
  expect(page.content[0].name).toBe("V");
});
