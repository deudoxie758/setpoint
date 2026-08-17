// A vision API needs enough resolution to read the play, not the source
// video's full resolution — capping it keeps every frame comfortably under
// the server's per-frame size limit even for a 4K upload, and cuts request cost.
const MAX_FRAME_DIMENSION = 960;

export async function captureFrames(file: File, count = 9): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await waitForEvent(video, "loadedmetadata");

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("Could not read video duration");
    }

    const scale = Math.min(1, MAX_FRAME_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context unavailable");
    }

    const frames: string[] = [];
    for (const timestamp of frameTimestamps(video.duration, count)) {
      video.currentTime = timestamp;
      await waitForEvent(video, "seeked");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.8));
    }

    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// A point's outcome is decided by a narrow window at the very end of a rally,
// which sparse/evenly-spaced sampling often misses. Most frames stay spread
// across the first EARLY_WINDOW_END_FRACTION of the clip for skill identification
// (visible across a window of motion); the rest are concentrated in the
// LATE_WINDOW_START_FRACTION-LATE_WINDOW_END_FRACTION window to raise the odds
// of actually catching the point-ending instant.
const EARLY_WINDOW_END_FRACTION = 0.75;
const LATE_WINDOW_START_FRACTION = 0.85;
const LATE_WINDOW_END_FRACTION = 0.98;
const LATE_FRAME_SHARE = 0.3;

function frameTimestamps(duration: number, count: number): number[] {
  if (count === 1) {
    return [duration * LATE_WINDOW_END_FRACTION];
  }

  const lateCount = Math.max(1, Math.round(count * LATE_FRAME_SHARE));
  const earlyCount = count - lateCount;
  const lateSpan = LATE_WINDOW_END_FRACTION - LATE_WINDOW_START_FRACTION;

  const timestamps: number[] = [];
  for (let i = 1; i <= earlyCount; i++) {
    timestamps.push(duration * EARLY_WINDOW_END_FRACTION * (i / earlyCount));
  }
  for (let i = 1; i <= lateCount; i++) {
    timestamps.push(duration * (LATE_WINDOW_START_FRACTION + lateSpan * (i / lateCount)));
  }
  return timestamps;
}

const EVENT_TIMEOUT_MS = 15000;

function waitForEvent(
  target: HTMLVideoElement,
  event: "loadedmetadata" | "seeked",
  timeoutMs = EVENT_TIMEOUT_MS
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for video to reach "${event}"`));
    }, timeoutMs);
    function onEvent() {
      cleanup();
      resolve();
    }
    function onError() {
      cleanup();
      reject(new Error(`Video failed while waiting for "${event}"`));
    }
    function cleanup() {
      clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError);
    }
    target.addEventListener(event, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}
