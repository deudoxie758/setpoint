import { getEmbedUrl } from "@/lib/embed";

describe("getEmbedUrl", () => {
  it("builds an embed URL for a youtube.com/watch link", () => {
    expect(getEmbedUrl("https://www.youtube.com/watch?v=abc123")).toBe(
      "https://www.youtube.com/embed/abc123"
    );
  });

  it("builds an embed URL for a youtu.be short link", () => {
    expect(getEmbedUrl("https://youtu.be/abc123")).toBe("https://www.youtube.com/embed/abc123");
  });

  it("builds an embed URL for a youtube.com/shorts link", () => {
    expect(getEmbedUrl("https://www.youtube.com/shorts/abc123")).toBe(
      "https://www.youtube.com/embed/abc123"
    );
  });

  it("builds an embed URL for a vimeo.com link", () => {
    expect(getEmbedUrl("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789"
    );
  });

  it("returns null for an unrecognized provider", () => {
    expect(getEmbedUrl("https://hudl.com/video/xyz")).toBeNull();
  });
});
