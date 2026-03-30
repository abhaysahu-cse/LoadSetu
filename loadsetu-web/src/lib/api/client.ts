import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "@/store";
import { useUIStore } from "@/store";

const SPRING_URL =
  process.env.NEXT_PUBLIC_SPRING_URL ?? "http://localhost:8080";
const FASTAPI_URL =
  process.env.NEXT_PUBLIC_FASTAPI_URL ?? "http://localhost:8000";

function generateRequestId(): string {
  return crypto.randomUUID();
}

function buildClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 15000,
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const { token } = useAuthStore.getState();
      const requestId = generateRequestId();

      if (token) {
        config.headers.set("Authorization", `Bearer ${token}`);
      }

      config.headers.set("X-Request-ID", requestId);
      useUIStore.getState().setLastRequestId(requestId);
      return config;
    },
    (error) => Promise.reject(error)
  );

  client.interceptors.response.use(
    (response: AxiosResponse) => {
      const backendRequestId = response.headers["x-request-id"] as string | undefined;
      if (backendRequestId) {
        useUIStore.getState().setLastRequestId(backendRequestId);
      }
      return response;
    },
    async (error) => {
      const { response } = error;

      if (!response) {
        useUIStore
          .getState()
          .addToast("Network error — check your connection", "error");
        return Promise.reject(error);
      }

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers["retry-after"] ?? "30", 10);
        useUIStore.getState().setRateLimit({
          active: true,
          retryAfterSeconds: retryAfter,
          endpoint: error.config?.url ?? null,
        });
        startRateLimitCountdown(retryAfter);
        return Promise.reject(error);
      }

      if (response.status === 401) {
        useAuthStore.getState().clearAuth();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      const requestId = response.headers["x-request-id"] ?? "N/A";
      const message = response.data?.error ?? response.data?.message ?? "Something went wrong";
      useUIStore.getState().addToast(`${message} [reqId: ${requestId}]`, "error");
      return Promise.reject(error);
    }
  );

  return client;
}

function startRateLimitCountdown(seconds: number) {
  let remaining = seconds;
  const interval = setInterval(() => {
    remaining -= 1;
    useUIStore.getState().setRateLimit({
      active: remaining > 0,
      retryAfterSeconds: remaining,
      endpoint: useUIStore.getState().rateLimit.endpoint,
    });
    if (remaining <= 0) {
      clearInterval(interval);
      useUIStore.getState().clearRateLimit();
    }
  }, 1000);
}

export const springClient = buildClient(SPRING_URL);
export const aiClient = buildClient(FASTAPI_URL);

export async function get<T>(
  client: AxiosInstance,
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await client.get<T>(url, config);
  return res.data;
}

export async function post<T>(
  client: AxiosInstance,
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await client.post<T>(url, data, config);
  return res.data;
}
