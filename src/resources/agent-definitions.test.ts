import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentDefinitions } from "./agent-definitions.js";

describe("AgentDefinitions", () => {
  const http = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() };
  const agents = new AgentDefinitions(http as never);

  beforeEach(() => vi.clearAllMocks());

  it("uses workspace-scoped definition routes", async () => {
    const definition = { id: "agent_1", latest_version: { version: 1 } };
    http.get
      .mockResolvedValueOnce({ data: [definition] })
      .mockResolvedValueOnce({ data: definition });
    http.post
      .mockResolvedValueOnce({ data: definition })
      .mockResolvedValueOnce({ data: { id: "version_2", version: 2 } });
    http.patch.mockResolvedValueOnce({
      data: { ...definition, name: "Operator" },
    });
    http.delete.mockResolvedValueOnce(undefined);

    await expect(agents.list({ workspaceId: "workspace_1" })).resolves.toEqual([
      definition,
    ]);
    expect(http.get).toHaveBeenNthCalledWith(1, "/agents", {
      workspace_id: "workspace_1",
      project_id: undefined,
      status: undefined,
    });
    await agents.get("agent_1");
    await agents.create({
      workspaceId: "workspace_1",
      name: "Maintainer",
      configuration: { harness: "codex" },
    });
    await agents.update("agent_1", { name: "Operator" });
    await agents.publish("agent_1", { harness: "claude-code" });
    await agents.archive("agent_1");

    expect(http.post).toHaveBeenNthCalledWith(2, "/agents/agent_1/versions", {
      configuration: { harness: "claude-code" },
    });
    expect(http.delete).toHaveBeenCalledWith("/agents/agent_1");
  });

  it("returns the raw entity instead of undefined when it carries an explicit undefined data field", async () => {
    const definitionWithUndefinedDataField = {
      id: "agent_2",
      latest_version: { version: 1 },
      data: undefined,
    };
    http.get.mockResolvedValueOnce(definitionWithUndefinedDataField);

    await expect(agents.get("agent_2")).resolves.toEqual(
      definitionWithUndefinedDataField,
    );
  });
});
