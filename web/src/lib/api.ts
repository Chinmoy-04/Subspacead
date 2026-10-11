import type {
  AblationRow,
  DatasetsInfo,
  FitResult,
  Health,
  ResultsData,
  RunDetail,
  RunSummary,
  ScoreResult,
  ScoreSource,
  TestImages,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError("The SubspaceAD API is not reachable.", 0);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // keep statusText
    }
    throw new ApiError(detail || `Request failed (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: (signal?: AbortSignal) => request<Health>("/api/health", { signal, cache: "no-store" }),
  datasets: () => request<DatasetsInfo>("/api/datasets"),
  testImages: (dataset: string, category: string) =>
    request<TestImages>(`/api/test-images?dataset=${dataset}&category=${encodeURIComponent(category)}`),
  imageUrl: (url: string, size = 320) => `${API_BASE}${url}?size=${size}`,
  fit: (params: {
    backbone: string;
    dataset: string;
    category: string;
    k: number;
    seed: number;
    image_size: number;
    n_aug: number;
    normals: File[];
  }) => {
    const form = new FormData();
    const { normals, ...rest } = params;
    for (const [key, value] of Object.entries(rest)) form.append(key, String(value));
    for (const f of normals) form.append("normals", f);
    return request<FitResult>("/api/fit", { method: "POST", body: form });
  },
  score: (params: { session_id: string; source: ScoreSource; index: number; file?: File | null }) => {
    const form = new FormData();
    form.append("session_id", params.session_id);
    form.append("source", params.source);
    form.append("index", String(params.index));
    if (params.file) form.append("file", params.file);
    return request<ScoreResult>("/api/score", { method: "POST", body: form });
  },
  results: () => request<ResultsData>("/api/results", { cache: "no-store" }),
  ablations: () => request<{ labels: Record<string, string>; rows: AblationRow[] }>("/api/ablations", { cache: "no-store" }),
  runs: () => request<{ runs: RunSummary[] }>("/api/runs", { cache: "no-store" }),
  run: (id: string) => request<RunDetail>(`/api/runs/${encodeURIComponent(id)}`, { cache: "no-store" }),
  pauseRun: (id: string) => request<{ ok: boolean; message: string }>(`/api/runs/${encodeURIComponent(id)}/pause`, { method: "POST" }),
  resumeRun: (id: string) => request<{ ok: boolean; message: string }>(`/api/runs/${encodeURIComponent(id)}/resume`, { method: "POST" }),
};
