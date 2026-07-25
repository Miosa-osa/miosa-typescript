import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SDK_USER_AGENT, SDK_VERSION } from "./version.js";

describe("release version", () => {
  it("matches package metadata and the user agent", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    expect(SDK_VERSION).toBe(manifest.version);
    expect(SDK_USER_AGENT).toBe(`@miosa/sdk/${manifest.version}`);
  });
});
