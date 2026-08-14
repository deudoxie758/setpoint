import { captureFrames } from "@/lib/captureFrames";

class FakeVideo extends EventTarget {
  muted = false;
  playsInline = false;
  duration = 10;
  videoWidth = 640;
  videoHeight = 360;
  src = "";
  seekedTimestamps: number[] = [];
  private _currentTime = 0;

  get currentTime() {
    return this._currentTime;
  }

  set currentTime(value: number) {
    this._currentTime = value;
    this.seekedTimestamps.push(value);
    queueMicrotask(() => this.dispatchEvent(new Event("seeked")));
  }
}

function fakeCanvas() {
  return {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: jest.fn() }),
    toDataURL: jest.fn(() => "data:image/jpeg;base64,FAKE"),
  } as unknown as HTMLCanvasElement;
}

describe("captureFrames", () => {
  let fakeVideo: FakeVideo;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    fakeVideo = new FakeVideo();
    originalCreateElement = document.createElement.bind(document);

    jest.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag === "video") return fakeVideo as unknown as HTMLVideoElement;
      if (tag === "canvas") return fakeCanvas();
      return originalCreateElement(tag);
    }) as typeof document.createElement);

    global.URL.createObjectURL = jest.fn(() => "blob:fake");
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("captures 4 frames at 20/40/60/80% of duration", async () => {
    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });

    const promise = captureFrames(file);
    fakeVideo.dispatchEvent(new Event("loadedmetadata"));

    const frames = await promise;

    expect(frames).toHaveLength(4);
    expect(frames.every((f) => f === "data:image/jpeg;base64,FAKE")).toBe(true);
    expect(fakeVideo.seekedTimestamps).toEqual([2, 4, 6, 8]);
  });

  it("revokes the object URL when done", async () => {
    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });

    const promise = captureFrames(file);
    fakeVideo.dispatchEvent(new Event("loadedmetadata"));
    await promise;

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });

  it("rejects when the video has no readable duration", async () => {
    fakeVideo.duration = NaN;
    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });

    const promise = captureFrames(file);
    fakeVideo.dispatchEvent(new Event("loadedmetadata"));

    await expect(promise).rejects.toThrow();
  });

  it("rejects when the video element errors before loading metadata", async () => {
    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });

    const promise = captureFrames(file);
    fakeVideo.dispatchEvent(new Event("error"));

    await expect(promise).rejects.toThrow();
  });
});
