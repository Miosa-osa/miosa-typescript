import { HttpClient } from "../http.js";
import type {
  CreditBalance,
  CreditTransactionListResponse,
  CreditUsage,
} from "../types.js";

export interface CreditTransactionListParams {
  page?: number;
  per_page?: number;
}

export class Credits {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** Get the current credit balance for the authenticated tenant. */
  async balance(): Promise<CreditBalance> {
    return this.http.get<CreditBalance>("/credits/balance");
  }

  /** List credit transactions (purchases, deductions). */
  async transactions(
    params?: CreditTransactionListParams,
  ): Promise<CreditTransactionListResponse> {
    const query: Record<string, number | undefined> = {
      page: params?.page,
      per_page: params?.per_page,
    };
    return this.http.get<CreditTransactionListResponse>(
      "/credits/transactions",
      query,
    );
  }

  /** Get aggregated credit usage for the current billing period. */
  async usage(): Promise<CreditUsage> {
    return this.http.get<CreditUsage>("/credits/usage");
  }
}
