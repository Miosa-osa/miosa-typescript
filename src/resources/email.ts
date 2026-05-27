/**
 * Email — admin email campaigns, templates, and inbox surfaces.
 *
 * Sub-namespaces:
 *   client.email.campaigns  — bulk email send-out lifecycle
 *   client.email.templates  — reusable templates (keyed by name)
 *   client.email.inbox      — inbound + outbound direct messages
 *
 * Routes: /admin/email-{campaigns,templates,inbox}/*
 * Requires admin credential (msk_a_* / msk_p_* or admin JWT).
 */

import type { HttpClient } from "../http.js";

function unwrap(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of [
      "data",
      "campaigns",
      "templates",
      "inbox",
      "deliveries",
      "items",
    ]) {
      if (k in d) return d[k] as Record<string, unknown>;
    }
  }
  return data as Record<string, unknown>;
}

function unwrapList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of [
      "data",
      "campaigns",
      "templates",
      "inbox",
      "deliveries",
      "items",
    ]) {
      if (Array.isArray(d[k])) return d[k] as Record<string, unknown>[];
    }
  }
  return [];
}

function strip(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  );
}

// ── Campaigns ──────────────────────────────────────────────────────────────

export class EmailCampaigns {
  constructor(private readonly http: HttpClient) {}

  async list(
    filters: Record<string, string | number | boolean | undefined> = {},
  ): Promise<Record<string, unknown>[]> {
    return unwrapList(
      await this.http.get<unknown>(
        "/admin/email-campaigns",
        filters as Record<string, string | number | boolean | undefined>,
      ),
    );
  }

  async create(
    attrs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.post<unknown>("/admin/email-campaigns", strip(attrs)),
    );
  }

  async recipientCount(
    filters: Record<string, string | number | boolean | undefined> = {},
  ): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.get<unknown>(
        "/admin/email-campaigns/recipient-count",
        filters,
      ),
    );
  }

  async send(
    campaignId: string,
    opts: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.post<unknown>(
        `/admin/email-campaigns/${campaignId}/send`,
        strip(opts),
      ),
    );
  }

  async cancel(campaignId: string): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.post<unknown>(
        `/admin/email-campaigns/${campaignId}/cancel`,
      ),
    );
  }

  async deliveries(
    campaignId: string,
    filters: Record<string, string | number | boolean | undefined> = {},
  ): Promise<Record<string, unknown>[]> {
    return unwrapList(
      await this.http.get<unknown>(
        `/admin/email-campaigns/${campaignId}/deliveries`,
        filters,
      ),
    );
  }
}

// ── Templates ──────────────────────────────────────────────────────────────

export class EmailTemplates {
  constructor(private readonly http: HttpClient) {}

  async list(
    filters: Record<string, string | number | boolean | undefined> = {},
  ): Promise<Record<string, unknown>[]> {
    return unwrapList(
      await this.http.get<unknown>("/admin/email-templates", filters),
    );
  }

  async create(
    key: string,
    attrs: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.post<unknown>("/admin/email-templates", {
        key,
        ...strip(attrs),
      }),
    );
  }

  async update(
    key: string,
    attrs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.put<unknown>(
        `/admin/email-templates/${key}`,
        strip(attrs),
      ),
    );
  }

  async reset(key: string): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.post<unknown>(`/admin/email-templates/${key}/reset`),
    );
  }
}

// ── Inbox ──────────────────────────────────────────────────────────────────

export class EmailInbox {
  constructor(private readonly http: HttpClient) {}

  async list(
    filters: Record<string, string | number | boolean | undefined> = {},
  ): Promise<Record<string, unknown>[]> {
    return unwrapList(
      await this.http.get<unknown>("/admin/email-inbox", filters),
    );
  }

  async send(attrs: Record<string, unknown>): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.post<unknown>("/admin/email-inbox/send", strip(attrs)),
    );
  }

  async markRead(messageId: string): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.post<unknown>(`/admin/email-inbox/${messageId}/read`),
    );
  }

  async archive(messageId: string): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.post<unknown>(`/admin/email-inbox/${messageId}/archive`),
    );
  }
}

// ── Top-level facade ────────────────────────────────────────────────────────

export class Email {
  readonly campaigns: EmailCampaigns;
  readonly templates: EmailTemplates;
  readonly inbox: EmailInbox;

  constructor(http: HttpClient) {
    this.campaigns = new EmailCampaigns(http);
    this.templates = new EmailTemplates(http);
    this.inbox = new EmailInbox(http);
  }
}
