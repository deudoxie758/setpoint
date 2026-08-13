import { apiFetch, ApiClientError } from "@/lib/apiClient";

describe("apiFetch", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the parsed JSON body on success", async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as jest.Mock;

    const result = await apiFetch<{ ok: boolean }>("/players");

    expect(result).toEqual({ ok: true });
  });

  it("returns undefined for a 204 response without attempting to parse a body", async () => {
    global.fetch = jest.fn(async () => new Response(null, { status: 204 })) as jest.Mock;

    const result = await apiFetch<void>("/players/1", { method: "DELETE" });

    expect(result).toBeUndefined();
  });

  it("throws an ApiClientError with the status and message on failure", async () => {
    global.fetch = jest.fn(
      async () => new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
    ) as jest.Mock;

    await expect(apiFetch("/players/does-not-exist")).rejects.toThrow(ApiClientError);
    await expect(apiFetch("/players/does-not-exist")).rejects.toMatchObject({
      status: 404,
      message: "Not found",
    });
  });
});
