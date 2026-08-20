import nextJest from "next/jest.js";

// next.confing.js 및 .env 파일들 테스트 환경에 로드하기 위해, Next.js 앱 경로 제공
const createJestConfig = nextJest({ dir: "./" });


// 사용자 정의 구성
/** @type {import('jest').Config} */
const config = {
  setupFiles: ["<rootDir>/jest.polyfills.js"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  // jsdom 기본 조건("browser")이면 msw/node 의 exports 에서 browser:null 로 막히므로 비운다.
  testEnvironmentOptions: { customExportConditions: [""] },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

// next/jest 가 transformIgnorePatterns 를 자체 설정하므로, 결과를 받아 덮어쓴다.
// MSW 2.13+ 의 ESM 전용 의존성(rettime 등)을 Jest 가 변환하도록 예외 처리.
const buildConfig = async () => {
  const jestConfig = await createJestConfig(config)();
  return {
    ...jestConfig,
    transformIgnorePatterns: [
      "/node_modules/(?!(msw|@mswjs|@open-draft|@bundled-es-modules|rettime|until-async|headers-polyfill|tagged-tag|set-cookie-parser|tough-cookie|type-fest)/)",
      "^.+\\.module\\.(css|sass|scss)$",
    ],
  };
};

export default buildConfig;
