import { renderHook, waitFor } from "@testing-library/react";
import { usePlayers, useCreatePlayer } from "@/hooks/usePlayers";
import { createWrapper } from "@/tests/helpers/queryWrapper";

describe("usePlayers", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("fetches and returns the players list", async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            players: [{ id: "1", name: "Jane Doe", position: null, graduationYear: null, createdAt: "2026-01-01" }],
          }),
          { status: 200 }
        )
    ) as jest.Mock;

    const { result } = renderHook(() => usePlayers(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe("Jane Doe");
  });
});

describe("useCreatePlayer", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("POSTs the form values and returns the created player", async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({ player: { id: "1", name: "Jane Doe", position: null, graduationYear: null, createdAt: "2026-01-01" } }),
          { status: 201 }
        )
    ) as jest.Mock;

    const { result } = renderHook(() => useCreatePlayer(), { wrapper: createWrapper() });

    result.current.mutate({ name: "Jane Doe" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/players"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
