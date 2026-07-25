import { describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../http.js";
import { Templates } from "./templates.js";

describe("Templates", () => {
  it("lists product-aware templates from /templates", async () => {
    const get = vi.fn().mockResolvedValue({
      templates: [
        {
          id: "miosa-sandbox",
          product: "sandbox",
          installed_tools: ["node", "python", "git"],
          readiness_contract: { exec_ready: true },
          benchmark_lane: { id: "default_customer_sandbox" },
          sizes: [{ size: "small", state: "fast_ready" }],
        },
        {
          id: "miosa-desktop",
          product: "computer",
          readiness_contract: { desktop_ready: true },
          benchmark_lane: { id: "computer_desktop" },
          sizes: [{ size: "small", state: "fast_ready" }],
        },
      ],
      readiness_states: ["fast_ready", "cold_boot_only", "missing"],
    });

    const templates = new Templates({ get } as unknown as HttpClient);
    const all = await templates.list();
    const sandboxes = await templates.list({ product: "sandbox" });
    const desktopReadiness = await templates.readiness("miosa-desktop");

    expect(get).toHaveBeenCalledWith("/templates");
    expect(all).toHaveLength(2);
    expect(sandboxes).toHaveLength(1);
    expect(sandboxes[0]?.id).toBe("miosa-sandbox");
    expect(desktopReadiness[0]?.state).toBe("fast_ready");
  });
});
