/* eslint-disable @typescript-eslint/no-require-imports */
// setupFiles 는 테스트 환경 구성 전에 CommonJS 로 실행되므로 require 를 써야 한다.
// MSW 2.x + jsdom: jsdom 전역에 없는 웹 표준 API 를 node 에서 주입한다.
// 주의: undici 는 로드 시점에 전역 TextDecoder 를 참조하므로, undici require 전에 먼저 정의해야 한다.
const { TextEncoder, TextDecoder } = require("node:util");
const webStreams = require("node:stream/web");
// MessageChannel/MessagePort 는 주입하지 않는다 — jsdom 이 제공하며,
// node:worker_threads 판을 넣으면 React scheduler 가 이를 잡아 Jest 가 종료되지 않는다.
const { BroadcastChannel } = require("node:worker_threads");

const define = (entries) => {
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) continue;
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
};

define({ TextEncoder, TextDecoder });
// ReadableStream/WritableStream/TransformStream 및 큐 전략 등 스트림 API 일괄 주입
define(webStreams);
define({ BroadcastChannel });

const { fetch, Headers, FormData, Request, Response } = require("undici");

define({ fetch, Headers, FormData, Request, Response });
