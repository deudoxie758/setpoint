import { renderHook, act, waitFor } from "@testing-library/react";
import { useUpload } from "@/hooks/useUpload";

class FakeXHR {
  static instances: FakeXHR[] = [];
  upload = { onprogress: null as ((e: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  status = 200;
  open = jest.fn();
  send = jest.fn(() => {
    FakeXHR.instances.push(this);
  });
}

describe("useUpload", () => {
  beforeEach(() => {
    FakeXHR.instances = [];
    (global as unknown as { XMLHttpRequest: typeof FakeXHR }).XMLHttpRequest = FakeXHR;
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            uploadUrl: "https://fake.supabase.co/upload/abc.mp4",
            token: "t",
            path: "abc.mp4",
            publicUrl: "https://fake.supabase.co/public/abc.mp4",
          }),
          { status: 200 }
        )
    ) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requests a signed URL and resolves the public URL after a successful PUT", async () => {
    const { result } = renderHook(() => useUpload());
    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });

    let uploadPromise: Promise<string>;
    act(() => {
      uploadPromise = result.current.upload(file);
    });

    await waitFor(() => expect(FakeXHR.instances).toHaveLength(1));
    act(() => {
      FakeXHR.instances[0].onload?.();
    });

    const publicUrl = await act(async () => uploadPromise!);
    expect(publicUrl).toBe("https://fake.supabase.co/public/abc.mp4");
  });

  it("sets an error message when the PUT fails", async () => {
    const { result } = renderHook(() => useUpload());
    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });

    let uploadPromise: Promise<string>;
    act(() => {
      uploadPromise = result.current.upload(file);
    });

    await waitFor(() => expect(FakeXHR.instances).toHaveLength(1));
    act(() => {
      FakeXHR.instances[0].status = 500;
      FakeXHR.instances[0].onload?.();
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await uploadPromise!;
      } catch (err) {
        thrown = err;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect(result.current.error).toBe("Upload failed with status 500");
  });
});
