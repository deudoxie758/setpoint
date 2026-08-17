export async function captureFrames(file: File, count = 4): Promise<string[]> {
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

// A point's outcome is decided by how the rally ends, which evenly-spaced
// sampling often misses (the ending action can land after the last evenly-spaced
// frame). Earlier frames stay evenly spread for skill identification; the final
// frame is pulled in close to the true end of the clip to capture that ending.
function frameTimestamps(duration: number, count: number): number[] {
  if (count === 1) {
    return [duration * 0.95];
  }
  const timestamps: number[] = [];
  for (let i = 1; i < count; i++) {
    timestamps.push((duration * i * 0.8) / count);
  }
  timestamps.push(duration * 0.95);
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
