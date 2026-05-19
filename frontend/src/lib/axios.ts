import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/authStore";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
  withCredentials: true, // refresh_token HttpOnly 쿠키 전송을 위해 필요
});

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

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // 실패한 요청의 원래 설정
    const original = error.config as RetryableRequest;

    // 401이 아닌 에러 || _retry(이전(또는 동시)요청에서 refresh 처리중인 경우) -> 에러
    if (error.response?.status !== 401 || original?._retry) {
      return Promise.reject(error);
    }

    // 동시에 401 코드를 받은 여러 요청 중, 한 요청이 먼저 Refresh를 시작하여
    // 이미 Refresh 요청이 처리중일 경우, 나머지 동시 요청들은 failedQueue에 넣어 대기
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(original));
          },
          reject,
        });
      });
    }

    // refresh 시도했음 + 진행중임을 기록
    original._retry = true;
    isRefreshing = true;

    try {
      // refresh 요청 후 받아온 토큰 store에 세팅
      const { data } = await apiClient.post<{ accessToken: string }>("/oauth2/token/refresh");
      const { accessToken } = data;
      useAuthStore.getState().setAccessToken(accessToken);
      // 큐에 대기중인 요청들에게 새 토큰 resolve
      processQueue(null, accessToken);
      // 원래 요청(original)도 새 토큰으로 재 시도
      original.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(original);
    } catch (refreshError) {
      // Refresh 실패시
      // 대기중인 요청 모두 reject
      processQueue(refreshError, null);
      // store의 인증 상태 초기화
      useAuthStore.getState().clearAuth();
      // 로그인 페이지로 이동
      window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      // 결과에 상관 없이 isRefreshing는 항상 해제
      isRefreshing = false;
    }
  }
);

export default apiClient;
