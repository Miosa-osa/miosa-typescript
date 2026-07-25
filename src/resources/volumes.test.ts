import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "../http.js";
import { Volumes } from "./volumes.js";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();
const mockRequest = vi.fn();

function makeHttp(): HttpClient {
  const http = {} as HttpClient;
  http.get = mockGet;
  http.post = mockPost;
  http.delete = mockDelete;
  http.request = mockRequest;
  return http;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Volumes", () => {
  it("supports top-level computer volume attachment helpers", async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: "att_1", volume_id: "vol_1", computer_id: "comp_1" }],
    });
    mockPost.mockResolvedValueOnce({
      data: {
        id: "att_2",
        volume_id: "vol_2",
        computer_id: "comp_1",
        mount_path: "/mnt/data",
        read_only: true,
      },
    });

    const volumes = new Volumes(makeHttp());
    const attachments = await volumes.listAttachments("comp_1");
    const attached = await volumes.attach("comp_1", {
      volumeId: "vol_2",
      mountPath: "/mnt/data",
      readOnly: true,
    });
    await volumes.detach("comp_1", "att_2");

    expect(mockGet).toHaveBeenCalledWith("/computers/comp_1/volumes");
    expect(attachments[0]?.id).toBe("att_1");
    expect(mockPost).toHaveBeenCalledWith("/computers/comp_1/volumes", {
      volume_id: "vol_2",
      mount_path: "/mnt/data",
      read_only: true,
    });
    expect(attached.id).toBe("att_2");
    expect(mockDelete).toHaveBeenCalledWith("/computers/comp_1/volumes/att_2");
  });
});
