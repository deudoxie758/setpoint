export async function captureFrames(file: File, count = 6): Promise<string[]> {
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

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
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

function waitForEvent(target: HTMLVideoElement, event: "loadedmetadata" | "seeked"): Promise<void> {
  return new Promise((resolve, reject) => {
    function onEvent() {
      cleanup();
      resolve();
    }
    function onError() {
      cleanup();
      reject(new Error(`Video failed while waiting for "${event}"`));
    }
    function cleanup() {
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError);
    }
    target.addEventListener(event, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}
