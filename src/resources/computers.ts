import { HttpClient } from "../http.js";
import type {
  ComputerCreateParams,
  ComputerData,
  ComputerId,
  ComputerListParams,
  ComputerUpdateParams,
} from "../types.js";
import { Computer } from "./computer.js";

export class Computers {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Create a new computer. The computer starts in `creating` state — call
   * `computer.start()` once it reaches `stopped` to boot it.
   */
  async create(params: ComputerCreateParams): Promise<Computer> {
    const data = await this.http.post<ComputerData>("/computers", {
      template_type: "miosa-desktop",
      size: "small",
      ...params,
    });
    return new Computer(this.http, data);
  }

  /**
   * List all computers for the authenticated tenant.
   */
  async list(params?: ComputerListParams): Promise<Computer[]> {
    const query: Record<string, string | number | boolean | undefined> = {
      page: params?.page,
      per_page: params?.per_page,
      status: params?.status,
    };
    const response = await this.http.get<{ data: ComputerData[] }>(
      "/computers",
      query,
    );
    return response.data.map((d) => new Computer(this.http, d));
  }

  /**
   * Fetch a single computer by ID.
   */
  async get(id: ComputerId | string): Promise<Computer> {
    const data = await this.http.get<ComputerData>(`/computers/${id}`);
    return new Computer(this.http, data);
  }

  /**
   * Update computer metadata or name.
   */
  async update(
    id: ComputerId | string,
    params: ComputerUpdateParams,
  ): Promise<Computer> {
    const data = await this.http.patch<ComputerData>(
      `/computers/${id}`,
      params,
    );
    return new Computer(this.http, data);
  }

  /**
   * Permanently delete a computer.
   */
  async delete(id: ComputerId | string): Promise<void> {
    return this.http.delete<void>(`/computers/${id}`);
  }
}
