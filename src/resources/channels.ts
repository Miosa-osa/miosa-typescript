/**
 * Channels — notification preferences + per-channel enable/disable.
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface ChannelData {
  id?: string;
  type?: string;
  name?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface ChannelListParams {
  type?: string;
  enabled?: boolean;
  [key: string]: string | number | boolean | undefined;
}

export interface ChannelCreateParams {
  type: string;
  name?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ChannelUpdateParams {
  name?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface NotificationPrefsUpdateParams {
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "channels", "notifications", "items"]) {
      if (k in p) return p[k] as T;
    }
  }
  return payload as T;
}

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  ) as Record<string, string | number | boolean | undefined>;
}

function stripUndefObj(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  );
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class Channels {
  constructor(private readonly http: HttpClient) {}

  /** List all channels for the tenant. */
  async list(params: ChannelListParams = {}): Promise<ChannelData[]> {
    const query = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.get<unknown>("/channels", query);
    const result = unwrap<ChannelData[] | unknown>(data);
    if (Array.isArray(result)) return result;
    return [];
  }

  /** Get a single channel. */
  async get(channelId: string): Promise<ChannelData> {
    const data = await this.http.get<unknown>(`/channels/${channelId}`);
    return unwrap<ChannelData>(data);
  }

  /** Create a new channel. */
  async create(params: ChannelCreateParams): Promise<ChannelData> {
    const body = stripUndefObj(params as Record<string, unknown>);
    const data = await this.http.post<unknown>("/channels", body);
    return unwrap<ChannelData>(data);
  }

  /** Update a channel. */
  async update(
    channelId: string,
    params: ChannelUpdateParams,
  ): Promise<ChannelData> {
    const body = stripUndefObj(params as Record<string, unknown>);
    const data = await this.http.patch<unknown>(`/channels/${channelId}`, body);
    return unwrap<ChannelData>(data);
  }

  /** Delete a channel. */
  async delete(channelId: string): Promise<void> {
    await this.http.delete<unknown>(`/channels/${channelId}`);
  }

  // ── Notification preferences ───────────────────────────────────────────────

  /** Get notification preferences across all channels. */
  async listNotifications(): Promise<Record<string, unknown>> {
    const data = await this.http.get<unknown>("/channels/notifications");
    return unwrap<Record<string, unknown>>(data);
  }

  /** Update notification preferences. */
  async updateNotifications(
    params: NotificationPrefsUpdateParams,
  ): Promise<Record<string, unknown>> {
    const body = stripUndefObj(params as Record<string, unknown>);
    const data = await this.http.put<unknown>("/channels/notifications", body);
    return unwrap<Record<string, unknown>>(data);
  }

  /** Enable a channel. */
  async enable(channelId: string): Promise<ChannelData> {
    const data = await this.http.post<unknown>(`/channels/${channelId}/enable`);
    return unwrap<ChannelData>(data);
  }

  /** Disable a channel. */
  async disable(channelId: string): Promise<ChannelData> {
    const data = await this.http.post<unknown>(
      `/channels/${channelId}/disable`,
    );
    return unwrap<ChannelData>(data);
  }
}
