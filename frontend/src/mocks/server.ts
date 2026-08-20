import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** jest(node) 환경용 MSW 서버. 테스트에서 server.use(...) 로 핸들러를 오버라이드한다. */
export const server = setupServer(...handlers);
