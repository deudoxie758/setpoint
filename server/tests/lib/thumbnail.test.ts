import { getThumbnailUrl } from "../../src/lib/thumbnail";

describe("getThumbnailUrl", () => {
  const realFetch = global.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    // jest.restoreAllMocks() only undoes jest.spyOn(); several tests below
    // reassign global.fetch directly (`global.fetch = jest.fn(...)`), which
    // it doesn't touch, so without this the mock leaks into later tests.
    global.fetch = realFetch;
  });

  it("builds a static img.youtube.com URL for a youtube.com/watch link, with no network call", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const result = await getThumbnailUrl("LINK", "https://www.youtube.com/watch?v=abc123");
    expect(result).toBe("https://img.youtube.com/vi/abc123/hqdefault.jpg");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("builds a static thumbnail URL for a youtube.com/shorts link", async () => {
    const result = await getThumbnailUrl("LINK", "https://www.youtube.com/shorts/xyz789");
    expect(result).toBe("https://img.youtube.com/vi/xyz789/hqdefault.jpg");
  });

  it("fetches the Vimeo oEmbed endpoint for a vimeo.com link", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ thumbnail_url: "https://i.vimeocdn.com/video/123_640.jpg" }), {
        status: 200,
      })
    ) as jest.Mock;

    const result = await getThumbnailUrl("LINK", "https://vimeo.com/76979871");

    expect(result).toBe("https://i.vimeocdn.com/video/123_640.jpg");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F76979871",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("returns null when the Vimeo oEmbed request fails", async () => {
    global.fetch = jest.fn(async () => new Response(null, { status: 404 })) as jest.Mock;

    const result = await getThumbnailUrl("LINK", "https://vimeo.com/does-not-exist-000");

    expect(result).toBeNull();
  });

  it("passes a bounded AbortSignal to the Vimeo fetch so a hanging request can't block indefinitely", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ thumbnail_url: "https://i.vimeocdn.com/video/123_640.jpg" }), {
        status: 200,
      })
    ) as jest.Mock;

    await getThumbnailUrl("LINK", "https://vimeo.com/76979871");

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns null for an unrecognized link provider", async () => {
    const result = await getThumbnailUrl("LINK", "https://hudl.com/video/xyz");
    expect(result).toBeNull();
  });

  it("returns null for an UPLOAD clip without making a network call", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const result = await getThumbnailUrl("UPLOAD", "https://storage.example.com/clip.mp4");
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
