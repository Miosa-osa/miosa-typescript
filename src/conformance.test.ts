import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import type { HttpClient } from "./http.js";
import {
  Sandboxes,
  type SandboxCreateParams,
} from "./resources/sandboxes.js";
import { Templates } from "./resources/templates.js";

type Fixture = {
  path: string;
  method: string;
  body: Record<string, unknown>;
};

const EXPECTED_CONTRACT_VERSION = "1.0.0";
const EXPECTED_CONTRACT_COMMIT =
  "774abcbc97380b599009759632691dc60d8e6b38";

function contractsRoot(): string {
  const configuredRoot = process.env.MIOSA_API_CONTRACTS_ROOT;
  const root = resolve(
    configuredRoot ??
      resolve(import.meta.dirname, "../../contract-fixtures/public-v1"),
  );
  try {
    const actualVersion = configuredRoot
      ? /^  version:\s*([^\s]+)\s*$/m.exec(
          readFileSync(resolve(root, "openapi/public-v1.yaml"), "utf8"),
        )?.[1]
      : readFileSync(resolve(root, "CONTRACT_VERSION"), "utf8").trim();
    if (actualVersion !== EXPECTED_CONTRACT_VERSION) {
      throw new Error(
        `found OpenAPI version ${String(actualVersion)}`,
      );
    }
    if (!configuredRoot) {
      const commit = readFileSync(resolve(root, "CONTRACT_COMMIT"), "utf8").trim();
      if (commit !== EXPECTED_CONTRACT_COMMIT) {
        throw new Error(`found contract commit ${commit}`);
      }
    }
  } catch (error) {
    throw new Error(
      `MIOSA API contracts unavailable or incompatible: resolved root=${root}; ` +
        `expected public-v1 version=${EXPECTED_CONTRACT_VERSION}; ` +
        `expected commit=${EXPECTED_CONTRACT_COMMIT}; ${String(error)}`,
    );
  }
  return root;
}

function fixture(name: string): Fixture {
  const path = resolve(
    contractsRoot(),
    "fixtures/conformance",
    `${name}.yaml`,
  );
  try {
    return parse(readFileSync(path, "utf8")) as Fixture;
  } catch (error) {
    throw new Error(
      `Cannot load conformance fixture ${path}; resolved root=${contractsRoot()}; ` +
        `expected public-v1 version=${EXPECTED_CONTRACT_VERSION}; ` +
        `expected commit=${EXPECTED_CONTRACT_COMMIT}; ${String(error)}`,
    );
  }
}

describe("public V1 conformance fixtures", () => {
  it("uses the canonical default-small create request", async () => {
    const create = fixture("create-default-small-request");
    const sandbox = fixture("sandbox-response");
    const request = vi.fn().mockResolvedValue(sandbox.body);

    await new Sandboxes({ request } as unknown as HttpClient).create(
      create.body as SandboxCreateParams,
    );

    expect(request).toHaveBeenCalledWith(create.path, {
      method: create.method.toUpperCase(),
      body: create.body,
    });
  });

  it("decodes sandbox, pause, and usage fixtures without losing fields", async () => {
    const sandboxFixture = fixture("sandbox-response");
    const pauseFixture = fixture("pause-response");
    const usageFixture = fixture("usage-response");
    const get = vi
      .fn()
      .mockResolvedValueOnce(sandboxFixture.body)
      .mockResolvedValueOnce(usageFixture.body);
    const post = vi.fn().mockResolvedValue(pauseFixture.body);
    const sandbox = await new Sandboxes({ get, post } as unknown as HttpClient).get(
      String(sandboxFixture.body.id),
    );

    await sandbox.pause();
    const usage = await sandbox.usage();

    expect(sandbox.data.resource_contract).toEqual(
      sandboxFixture.body.resource_contract,
    );
    expect(sandbox.data.timeout_remaining_ms).toBe(3_599_000);
    expect(sandbox.state).toBe("paused");
    expect(usage).toEqual(usageFixture.body.data);
  });

  it("decodes the canonical top-level template catalog", async () => {
    const templatesFixture = fixture("templates-response");
    const get = vi.fn().mockResolvedValue(templatesFixture.body);
    const templates = new Templates({ get } as unknown as HttpClient);

    const catalog = await templates.catalog();

    expect(catalog.templates).toEqual(templatesFixture.body.templates);
    expect(catalog.shape_contracts).toEqual(
      templatesFixture.body.shape_contracts,
    );
  });
});
