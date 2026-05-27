/**
 * ComputerOsa — task dispatch to the in-VM OSA agent.
 *
 * Routes:
 *   POST   /computers/:id/osa/task
 *   DELETE /computers/:id/osa/task
 *   GET    /computers/:id/osa/status
 *   POST   /computers/:id/osa/configure
 */

import type { HttpClient } from "../http.js";

function unwrap(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if ("data" in d && Object.keys(d).length <= 2) {
      return d.data as Record<string, unknown>;
    }
  }
  return (data ?? {}) as Record<string, unknown>;
}

export class ComputerOsa {
  constructor(
    private readonly http: HttpClient,
    private readonly computerId: string,
  ) {}

  /** Submit a free-form task to the in-VM OSA agent. */
  async submitTask(
    task: string,
    params: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const body = {
      task,
      ...Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined),
      ),
    };
    return unwrap(
      await this.http.post<unknown>(
        `/computers/${this.computerId}/osa/task`,
        body,
      ),
    );
  }

  /** Cancel the currently-running OSA task, if any. */
  async cancelTask(): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.delete<unknown>(`/computers/${this.computerId}/osa/task`),
    );
  }

  /** Return OSA's current task / configuration / health snapshot. */
  async status(): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.get<unknown>(`/computers/${this.computerId}/osa/status`),
    );
  }

  /** Update OSA runtime configuration (model, tools, secrets, etc.). */
  async configure(
    config: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = Object.fromEntries(
      Object.entries(config).filter(([, v]) => v !== undefined),
    );
    return unwrap(
      await this.http.post<unknown>(
        `/computers/${this.computerId}/osa/configure`,
        body,
      ),
    );
  }
}
