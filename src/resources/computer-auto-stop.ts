/**
 * ComputerAutoStop — read/update idle-timeout config.
 *
 * Routes:
 *   GET   /computers/:id/auto-stop
 *   PATCH /computers/:id/auto-stop
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

export class ComputerAutoStop {
  constructor(
    private readonly http: HttpClient,
    private readonly computerId: string,
  ) {}

  /** Return the current auto-stop configuration. */
  async get(): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.get<unknown>(`/computers/${this.computerId}/auto-stop`),
    );
  }

  /** Set the idle timeout in seconds (0 disables auto-stop). */
  async update(seconds: number): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.patch<unknown>(
        `/computers/${this.computerId}/auto-stop`,
        { seconds },
      ),
    );
  }
}
