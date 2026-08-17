import { renderHook, waitFor } from "@testing-library/react";
import { useAiStatus, useSuggestTags } from "@/hooks/useAiTagging";
import { createWrapper } from "@/tests/helpers/queryWrapper";

describe("useAiStatus", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns whether AI tagging is available", async () => {
    global.fetch = jest.fn(
      async () => new Response(JSON.stringify({ available: true }), { status: 200 })
    ) as jest.Mock;

    const { result } = renderHook(() => useAiStatus(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(true);
  });
});

describe("useSuggestTags", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("POSTs the frames plus playerId/jersey color/number and returns the suggestion with its token", async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            skill: "SPIKE",
            outcome: "POINT_WON",
            confidence: 0.8,
            rationale: "Jump and strike.",
            token: "signed-token-abc",
          }),
          { status: 200 }
        )
    ) as jest.Mock;

    const { result } = renderHook(() => useSuggestTags(), { wrapper: createWrapper() });

    result.current.mutate({
      frames: ["data:image/jpeg;base64,AAA"],
      jerseyColor: "white",
      jerseyNumber: "7",
      playerId: "p1",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      skill: "SPIKE",
      outcome: "POINT_WON",
      confidence: 0.8,
      rationale: "Jump and strike.",
      token: "signed-token-abc",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/ai/suggest-tags"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          frames: ["data:image/jpeg;base64,AAA"],
          jerseyColor: "white",
          jerseyNumber: "7",
          playerId: "p1",
        }),
      })
    );
  });

  it("includes position in the request body when provided", async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            skill: "BLOCK",
            outcome: "POINT_WON",
            confidence: 0.85,
            rationale: "Blocked at the net.",
            token: "signed-token-def",
          }),
          { status: 200 }
        )
    ) as jest.Mock;

    const { result } = renderHook(() => useSuggestTags(), { wrapper: createWrapper() });

    result.current.mutate({
      frames: ["data:image/jpeg;base64,AAA"],
      jerseyColor: "red",
      jerseyNumber: "5",
      position: "Middle Blocker",
      playerId: "p1",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/ai/suggest-tags"),
      expect.objectContaining({
        body: JSON.stringify({
          frames: ["data:image/jpeg;base64,AAA"],
          jerseyColor: "red",
          jerseyNumber: "5",
          position: "Middle Blocker",
          playerId: "p1",
        }),
      })
    );
  });
});
