import { HttpClient } from "../../http.js";
import type {
  HostId,
  JobData,
  JobEvent,
  JobId,
  JobListResponse,
  JobRunParams,
} from "./types.js";

/**
 * Jobs resource — run commands on a remote OpenComputers host and stream output.
 *
 * ```ts
 * const job = await client.openComputers.jobs.run(hostId, { command: "npm test" });
 * for await (const event of client.openComputers.jobs.stream(hostId, job.id)) {
 *   process.stdout.write(String(event.data ?? ""));
 *   if (event.type === "done") break;
 * }
 * ```
 */
export class Jobs {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  private base(hostId: string): string {
    return `/opencomputers/hosts/${hostId}`;
  }

  /**
   * Dispatch a command to run on the remote host.
   */
  async run(hostId: HostId | string, params: JobRunParams): Promise<JobData> {
    return this.http.post<JobData>(`${this.base(hostId)}/exec`, params);
  }

  /**
   * List all jobs for a host.
   */
  async list(hostId: HostId | string): Promise<JobListResponse> {
    return this.http.get<JobListResponse>(`${this.base(hostId)}/exec`);
  }

  /**
   * Fetch the current state of a job.
   */
  async get(hostId: HostId | string, jobId: JobId | string): Promise<JobData> {
    return this.http.get<JobData>(`${this.base(hostId)}/exec/${jobId}`);
  }

  /**
   * Stream live output from a running job.
   *
   * Yields `JobEvent` objects with `type` of `stdout`, `stderr`, `exit`, or
   * `done`. Break the loop when you receive `done` or `exit`.
   */
  stream(
    hostId: HostId | string,
    jobId: JobId | string,
  ): AsyncIterableIterator<JobEvent> {
    return this.http.stream<JobEvent>(
      `${this.base(hostId)}/exec/${jobId}/stream`,
    );
  }

  /**
   * Cancel a running or queued job.
   */
  async cancel(hostId: HostId | string, jobId: JobId | string): Promise<void> {
    return this.http.delete<void>(`${this.base(hostId)}/exec/${jobId}`);
  }
}
