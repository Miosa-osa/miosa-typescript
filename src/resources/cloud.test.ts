import { describe, expect, it, vi } from "vitest";
import { Cloud } from "./cloud.js";
import type { HttpClient } from "../http.js";

describe("Cloud", () => {
  it("creates an AWS BYOC account and attaches the assume-role ARN", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          id: "cloud_acct_123",
          provider: "aws",
          mode: "customer_byoc",
          external_id: "miosa_ext_abc",
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: "cloud_acct_123",
          role_arn: "arn:aws:iam::123456789012:role/MiosaByocRole",
          default_region: "us-east-1",
        },
      });
    const http = { post } as unknown as HttpClient;
    const cloud = new Cloud(http);

    const account = await cloud.createAccount({
      provider: "aws",
      mode: "customer_byoc",
      displayName: "Customer AWS",
      externalAccountId: "123456789012",
    });
    const attached = await cloud.attachAwsRole(account.id, {
      roleArn: "arn:aws:iam::123456789012:role/MiosaByocRole",
      defaultRegion: "us-east-1",
    });

    expect(post).toHaveBeenNthCalledWith(1, "/cloud/accounts", {
      provider: "aws",
      mode: "customer_byoc",
      display_name: "Customer AWS",
      external_account_id: "123456789012",
    });
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/cloud/accounts/cloud_acct_123/aws/role",
      {
        role_arn: "arn:aws:iam::123456789012:role/MiosaByocRole",
        default_region: "us-east-1",
      },
    );
    expect(account.external_id).toBe("miosa_ext_abc");
    expect(attached.default_region).toBe("us-east-1");
  });

  it("creates cloud regions, pools, and records preflight results", async () => {
    const get = vi.fn().mockResolvedValue({ data: [{ id: "run_1" }] });
    const post = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "region_1", provider_region: "us-east-1" } })
      .mockResolvedValueOnce({ data: { id: "pool_1", instance_type: "c6i.metal" } })
      .mockResolvedValueOnce({ data: { id: "run_1", status: "pass" } });
    const http = { get, post } as unknown as HttpClient;
    const cloud = new Cloud(http);

    await cloud.createRegion({
      cloudAccountId: "cloud_acct_123",
      providerRegion: "us-east-1",
      providerZone: "us-east-1a",
      displayName: "N. Virginia",
    });
    await cloud.createPool({
      cloudRegionId: "region_1",
      instanceType: "c6i.metal",
      targetNodes: 1,
      maxNodes: 4,
    });
    await cloud.recordPreflight({
      cloudAccountId: "cloud_acct_123",
      provider: "aws",
      status: "pass",
      checks: { sts_identity: { status: "pass" } },
    });
    await cloud.listPreflights({ cloudAccountId: "cloud_acct_123", limit: 10 });

    expect(post).toHaveBeenNthCalledWith(1, "/cloud/regions", {
      cloud_account_id: "cloud_acct_123",
      provider_region: "us-east-1",
      provider_zone: "us-east-1a",
      display_name: "N. Virginia",
    });
    expect(post).toHaveBeenNthCalledWith(2, "/cloud/pools", {
      cloud_region_id: "region_1",
      instance_type: "c6i.metal",
      target_nodes: 1,
      max_nodes: 4,
    });
    expect(post).toHaveBeenNthCalledWith(3, "/cloud/preflights", {
      cloud_account_id: "cloud_acct_123",
      provider: "aws",
      status: "pass",
      checks: { sts_identity: { status: "pass" } },
    });
    expect(get).toHaveBeenCalledWith("/cloud/preflights", {
      cloud_account_id: "cloud_acct_123",
      limit: 10,
    });
  });
});
