import { describe, expect, it, vi } from "vitest";
import { RuntimeCapabilitiesResource } from "./runtime-capabilities.js";
import type { HttpClient } from "../http.js";

describe("RuntimeCapabilitiesResource", () => {
  it("fetches the live runtime capability contract", async () => {
    const get = vi.fn().mockResolvedValueOnce({
      data: {
        version: 1,
        runs: {
          contract_fields: ["execution_packet", "expected_outputs"],
        },
      },
    });

    const resource = new RuntimeCapabilitiesResource({ get } as unknown as HttpClient);
    const result = await resource.get();

    expect(get).toHaveBeenCalledWith("/runtime-capabilities");
    expect(result.runs?.["contract_fields"]).toEqual([
      "execution_packet",
      "expected_outputs",
    ]);
  });
});
