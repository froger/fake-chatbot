import { flushSync } from "react-dom";
import { toCanvas } from "html-to-image";
import {
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  getFirstEncodableVideoCodec,
  getFirstEncodableAudioCodec,
} from "mediabunny";
import { exportOptions, buildChatTimeline } from "./utils";
import { renderTimelineAudio } from "./sounds";

/*
 * Chat-story video export.
 *
 * Instead of recording the screen in real time (slow and choppy), the video is
 * built frame by frame: for every frame we set the exact animation state, take
 * a snapshot of the phone and hand it to the browser's video encoder
 * (WebCodecs, through mediabunny). Frames where nothing moves reuse the last
 * snapshot, so rendering stays fast and playback is a steady 30 fps.
 */

export const FPS = 30;
const BUBBLE_ANIM = 0.3;
const SCROLL_ANIM = 0.35;
const MAX_WIDTH = 1080;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const even = (n) => Math.max(2, Math.round(n / 2) * 2);

export const videoDuration = (messages) =>
  buildChatTimeline(Array.isArray(messages) ? messages : []).duration;

export class VideoUnsupportedError extends Error {
  name = "VideoUnsupportedError";
}

const presenceAt = (indicators, t) => {
  for (const ind of indicators) {
    if (!ind) continue;
    if (t >= ind.start - 1e-6 && t < ind.end - 1e-6) {
      return {
        kind: ind.kind,
        self: ind.self,
        phase: t - ind.start,
      };
    }
  }
  return null;
};

/**
 * @param {object} p
 * @param {HTMLElement} p.phoneEl - element to film
 * @param {object[]} p.messages - full message list
 * @param {Function} p.setMessageList - React state setter
 * @param {Function} [p.setPresence] - typing / recording indicator setter
 * @param {(percent: number) => void} [p.onProgress]
 * @param {AbortSignal} [p.signal]
 * @returns {Promise<{blob: Blob, extension: string}>}
 */
export async function renderChatVideo({
  phoneEl,
  messages,
  setMessageList,
  setPresence,
  onProgress,
  signal,
}) {
  if (typeof VideoEncoder === "undefined") throw new VideoUnsupportedError();

  const box = phoneEl.querySelector(".chatMessages");
  const inner = box.querySelector(".chatInner");

  // Output size: phone size at 2x (max 1080px wide), even numbers for H.264.
  const rect = phoneEl.getBoundingClientRect();
  const scale = Math.min(2, MAX_WIDTH / rect.width);
  const width = even(rect.width * scale);
  const height = even(rect.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Prefer MP4/H.264 (plays everywhere), fall back to WebM.
  const videoCodec = await getFirstEncodableVideoCodec(["avc", "vp9", "vp8"], {
    width,
    height,
  });
  if (!videoCodec) throw new VideoUnsupportedError();
  const isMp4 = videoCodec === "avc";
  const format = isMp4
    ? new Mp4OutputFormat({ fastStart: "in-memory" })
    : new WebMOutputFormat();
  const audioCodec = await getFirstEncodableAudioCodec(
    isMp4 ? ["aac", "opus"] : ["opus"],
    { numberOfChannels: 2, sampleRate: 48000 }
  );

  const output = new Output({ format, target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, {
    codec: videoCodec,
    bitrate: QUALITY_HIGH,
  });
  output.addVideoTrack(videoSource, { frameRate: FPS });
  let audioSource = null;
  if (audioCodec) {
    audioSource = new AudioBufferSource({ codec: audioCodec, bitrate: QUALITY_MEDIUM });
    output.addAudioTrack(audioSource);
  }

  const { appear, indicators, duration } = buildChatTimeline(messages);
  const totalFrames = Math.ceil(duration * FPS);
  const options = await exportOptions(phoneEl, { pixelRatio: scale });

  phoneEl.classList.add("recording");
  let finished = false;
  try {
    await output.start();

    if (audioSource) {
      const audio = await renderTimelineAudio(
        messages.map((m, i) => ({ time: appear[i], self: m.self === true })),
        duration
      );
      await audioSource.add(audio);
    }

    let shown = -1;
    let offset = 0;
    let scrollFrom = 0;
    let scrollTo = 0;
    let lastKey = "";
    let lastPresenceKey = "";

    for (let f = 0; f < totalFrames; f++) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const t = f / FPS;

      const presence = presenceAt(indicators, t);
      const presenceKey = presence
        ? `${presence.kind}|${presence.self}|${presence.phase.toFixed(2)}`
        : "";

      // Which messages are visible at this moment?
      let count = 0;
      while (count < appear.length && appear[count] <= t + 1e-6) count++;
      const presenceChanged = presenceKey !== lastPresenceKey;
      const countChanged = count !== shown;
      if (presenceChanged) {
        lastPresenceKey = presenceKey;
        if (setPresence) flushSync(() => setPresence(presence));
      }
      if (countChanged) {
        flushSync(() => setMessageList(messages.slice(0, count)));
        shown = count;
      }
      if (presenceChanged || countChanged) {
        box.scrollTop = 0;
        scrollFrom = offset;
        scrollTo = Math.max(0, inner.offsetHeight - box.clientHeight);
      }

      const since = count > 0 ? t - appear[count - 1] : Infinity;
      const p = clamp01(since / BUBBLE_ANIM);
      offset = scrollFrom + (scrollTo - scrollFrom) * easeOutCubic(clamp01(since / SCROLL_ANIM));

      // Only re-render the phone when something actually changed.
      const key = `${count}|${p.toFixed(3)}|${offset.toFixed(1)}|${presenceKey}`;
      if (key !== lastKey) {
        lastKey = key;
        inner.style.transform = `translateY(${-offset}px)`;
        const bubbles = inner.querySelectorAll(".message");
        const newest = bubbles[bubbles.length - 1];
        if (newest) {
          const e = easeOutBack(p);
          newest.style.opacity = String(clamp01(p * 2.5));
          newest.style.transform = `translateY(${(1 - e) * 16}px) scale(${0.94 + 0.06 * e})`;
        }
        const frame = await toCanvas(phoneEl, options);
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(frame, 0, 0, width, height);
      }

      await videoSource.add(t, 1 / FPS);
      onProgress?.(((f + 1) / totalFrames) * 100);
    }

    await output.finalize();
    finished = true;
    return {
      blob: new Blob([output.target.buffer], { type: format.mimeType }),
      extension: format.fileExtension,
    };
  } finally {
    if (!finished) await output.cancel().catch(() => {});
    phoneEl.classList.remove("recording");
    inner.style.transform = "";
    if (setPresence) flushSync(() => setPresence(null));
    flushSync(() => setMessageList(messages));
    inner.querySelectorAll(".message").forEach((el) => {
      el.style.opacity = "";
      el.style.transform = "";
    });
    box.scrollTop = box.scrollHeight;
  }
}
