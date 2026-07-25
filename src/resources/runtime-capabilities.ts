import type { HttpClient } from "../http.js";

export interface RuntimeCapabilities {
  version: number;
  targets?: Record<string, unknown>;
  runs?: Record<string, unknown>;
  run_groups?: Record<string, unknown>;
  runtime_env?: Record<string, unknown>;
  files?: Record<string, unknown>;
  orchestration?: Record<string, unknown>;
  [key: string]: unknown;
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export class RuntimeCapabilitiesResource {
  constructor(private readonly http: HttpClient) {}

  async get(): Promise<RuntimeCapabilities> {
    return unwrap<RuntimeCapabilities>(
      await this.http.get<unknown>("/runtime-capabilities"),
    );
  }
}
