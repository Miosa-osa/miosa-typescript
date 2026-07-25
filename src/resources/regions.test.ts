import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../http.js";
import { Regions } from "./regions.js";

const mockGet = vi.fn();

function makeHttp(): HttpClient {
  const http = {} as HttpClient;
  http.get = mockGet;
  return http;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Regions", () => {
  it("gets the canonical compute catalog with artifact readiness", async () => {
    mockGet.mockResolvedValue({
      data: {
        products: [
          {
            id: "sandbox",
            default_template: "miosa-sandbox-prod-1",
            templates: [
              {
                id: "nextjs",
                size_ids: ["small", "medium"],
                artifact_readiness: [
                  {
                    size: "medium",
                    state: "fast_ready",
                    checked_nodes: 10,
                    ready_nodes: 10,
                  },
                ],
              },
            ],
          },
        ],
        sizes: [{ slug: "medium", memory_mb: 4096 }],
      },
    });

    const catalog = await new Regions(makeHttp()).catalog();

    expect(mockGet).toHaveBeenCalledWith("/compute/catalog");
    expect(catalog.products[0]?.id).toBe("sandbox");
    expect(catalog.products[0]?.templates?.[0]?.id).toBe("nextjs");
    expect(
      catalog.products[0]?.templates?.[0]?.artifact_readiness?.[0]?.state,
    ).toBe("fast_ready");
    expect(
      catalog.products[0]?.templates?.[0]?.artifact_readiness?.[0]?.ready_nodes,
    ).toBe(10);
  });
});
