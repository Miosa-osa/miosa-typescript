/**
 * Integrations — OAuth account-level connections (GitHub, Slack, Linear, Discord).
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface IntegrationData {
  id?: string;
  provider?: string;
  status?: string;
  connected_at?: string;
  [key: string]: unknown;
}

export interface IntegrationCatalogEntry {
  provider?: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export interface GithubRepo {
  id?: number;
  name?: string;
  full_name?: string;
  private?: boolean;
  [key: string]: unknown;
}

export interface GithubSshKey {
  id?: number;
  title?: string;
  key?: string;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface SlackSendTestParams {
  message?: string;
  channel?: string;
  [key: string]: unknown;
}

export interface DiscordSendTestParams {
  message?: string;
  channel_id?: string;
  [key: string]: unknown;
}

export interface LinearCreateIssueParams {
  title?: string;
  description?: string;
  team_id?: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "integrations", "catalog", "items"]) {
      if (k in p) return p[k] as T;
    }
  }
  return payload as T;
}

function listItems<T>(payload: unknown): T[] {
  const result = unwrap<T[] | unknown>(payload);
  if (Array.isArray(result)) return result;
  return [];
}

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  );
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class Integrations {
  constructor(private readonly http: HttpClient) {}

  /** List active OAuth integrations for the tenant. */
  async list(): Promise<IntegrationData[]> {
    const data = await this.http.get<unknown>("/integrations");
    return listItems<IntegrationData>(data);
  }

  /** List available providers in the integration catalog. */
  async catalog(): Promise<IntegrationCatalogEntry[]> {
    const data = await this.http.get<unknown>("/integrations/catalog");
    return listItems<IntegrationCatalogEntry>(data);
  }

  /** Begin the OAuth flow for a provider — returns an authorize URL. */
  async start(provider: string): Promise<Record<string, unknown>> {
    const data = await this.http.get<unknown>(
      `/integrations/${provider}/start`,
    );
    return unwrap<Record<string, unknown>>(data);
  }

  /** Force-refresh the access token for a provider. */
  async refresh(provider: string): Promise<Record<string, unknown>> {
    const data = await this.http.post<unknown>(
      `/integrations/${provider}/refresh`,
    );
    return unwrap<Record<string, unknown>>(data);
  }

  /** Disconnect (revoke) an integration. */
  async disconnect(provider: string): Promise<void> {
    await this.http.delete<unknown>(`/integrations/${provider}`);
  }

  // ── GitHub-specific capabilities ───────────────────────────────────────────

  /** List GitHub repositories accessible to this integration. */
  async githubRepos(): Promise<GithubRepo[]> {
    const data = await this.http.get<unknown>("/integrations/github/repos");
    return listItems<GithubRepo>(data);
  }

  /** List configured GitHub deploy keys. */
  async githubSshKeys(): Promise<GithubSshKey[]> {
    const data = await this.http.get<unknown>("/integrations/github/ssh-keys");
    return listItems<GithubSshKey>(data);
  }

  // ── Test hooks ─────────────────────────────────────────────────────────────

  /** Send a test message to the connected Slack channel. */
  async slackSendTest(
    params: SlackSendTestParams = {},
  ): Promise<Record<string, unknown>> {
    const body = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.post<unknown>(
      "/integrations/slack/send-test",
      body,
    );
    return unwrap<Record<string, unknown>>(data);
  }

  /** Send a test message to the connected Discord channel. */
  async discordSendTest(
    params: DiscordSendTestParams = {},
  ): Promise<Record<string, unknown>> {
    const body = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.post<unknown>(
      "/integrations/discord/send-test",
      body,
    );
    return unwrap<Record<string, unknown>>(data);
  }

  // ── Linear dedicated controller ────────────────────────────────────────────

  /** Begin Linear OAuth — Linear has provider-specific error shapes. */
  async linearStart(): Promise<Record<string, unknown>> {
    const data = await this.http.get<unknown>("/integrations/linear/start");
    return unwrap<Record<string, unknown>>(data);
  }

  /** Create a Linear issue via the connected workspace. */
  async linearCreateIssue(
    params: LinearCreateIssueParams = {},
  ): Promise<Record<string, unknown>> {
    const body = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.post<unknown>(
      "/integrations/linear/create-issue",
      body,
    );
    return unwrap<Record<string, unknown>>(data);
  }
}
