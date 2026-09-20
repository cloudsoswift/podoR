import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/authStore";
import { loginRedirectUrl } from "@/lib/redirect";
import { gatedEventId, notifyQueuePassLost } from "@/lib/queuePassLost";

// AxiosInstance용 공통 설정
const clientConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
  withCredentials: true, // refresh_token HttpOnly 쿠키 전송을 위해 필요
};

const apiClient = axios.create(clientConfig);

// refresh 전용 클라이언트: 인터셉터가 없어 refresh 응답이 인터셉터에
// 재진입하지 않는다. (RT까지 만료된 경우의 데드락 방지)
const refreshClient = axios.create(clientConfig);

apiClient.interceptors.request.use((config) => {
  // 매 요청시, store에 access token 있으면 가져와서
  // 헤더에 추가
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 재시도할 요청
type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

// 진행 중인 재발급 요청. 값이 있다는 것 자체가 "지금 갱신 중"이라는 것을 뜻함.
let refreshPromise: Promise<string> | null = null;

/**
 * 새 Access Token 을 받아 store 에 반영한다.
 *
 * 동시에 401 에러를 받은 요청들이 모두 이 함수를 호출하지만, 이미 진행 중인 Promise 가 있으면 이를 반환해 refresh 요청은 한 번만 나감.
 */
const refreshAccessToken = (): Promise<string> => {
  refreshPromise ??= refreshClient
    .post<{ accessToken: string }>("/oauth2/token/refresh")
    .then(({ data }) => {
      useAuthStore.getState().setAccessToken(data.accessToken);
      return data.accessToken;
    })
    .finally(() => {
      // 실패한 Promise를 재사용하는 경우를 방지하기 위해 성공이든 실패든 refreshPromise를 비움.
      refreshPromise = null;
    });

  return refreshPromise;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // 실패한 요청의 원래 설정
    const original = error.config as RetryableRequest;

    // 게이트 대상 API의 403은 입장권을 잃었다는 뜻임. 따라서 대기열 게이트에 알린다.
    // 알리기만 하고 거부는 그대로 전달하며, 따라서 호출부의 catch 블럭은 평소대로 실행됨.
    if (error.response?.status === 403) {
      const eventId = gatedEventId(original?.url);
      if (eventId) notifyQueuePassLost(eventId);
    }

    // 401이 아닌 에러 || 재시도한 요청이 또 401 -> 에러
    if (error.response?.status !== 401 || original?._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    try {
      // 갱신이 이미 진행 중이면 그 결과를 기다림.
      const accessToken = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(original);
    } catch (refreshError) {
      // RT 까지 만료/무효된 경우, 인증 상태를 비우고 로그인 페이지로 보냄.
      // (이때, 로그인 후 지금 페이지로 돌아오도록 경로를 실음)
      useAuthStore.getState().clearAuth();
      window.location.href = loginRedirectUrl(window.location);
      return Promise.reject(refreshError);
    }
  }
);

export default apiClient;
