import { getFontEmbedCSS } from "html-to-image";

// Must match `.messageBlock` bubbleIn duration in ChatMessage CSS.
export const BUBBLE_IN_SEC = 0.28;
// Pause after a bubble appears (includes fade-in), before the next indicator.
export const AFTER_MESSAGE_GAP = Math.max(0.75, BUBBLE_IN_SEC);
// Kept for anything that still expects a fixed beat between messages.
export const MESSAGE_GAP = 2;

// Phone typing pace for indicators. Them: length/6; you: length/4 (capped lower).
export const SLOW_CHARS_PER_SEC = 4;
export const THEM_CHARS_PER_SEC = 6;
export const TYPING_MIN_SEC = 0.45;
export const TYPING_MAX_SEC = 3;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * WhatsApp-style pre-message activity, or null (quick replies / image-only).
 * @returns {{ kind: 'typing'|'recording', self: boolean, duration: number } | null}
 */
export const messageIndicator = (message) => {
  if (!message || message.fromReply) return null;
  if (message.audio?.durationSec != null) {
    const d = Number(message.audio.durationSec) || 0;
    // Fake send: show recording at 5× real duration (8s note → ~1.6s indicator).
    return {
      kind: "recording",
      self: message.self === true,
      duration: Math.min(12, Math.max(0.5, d / 5)),
    };
  }
  const text = String(message.text ?? "").trim();
  if (!text) return null;
  const self = message.self === true;
  // You: ≤1s. Them: min(3, max(0.45, length/6)).
  const maxSec = self ? 1 : TYPING_MAX_SEC;
  const cps = self ? SLOW_CHARS_PER_SEC : THEM_CHARS_PER_SEC;
  const duration = Math.min(
    maxSec,
    Math.max(TYPING_MIN_SEC, text.length / cps)
  );
  return { kind: "typing", self, duration };
};

/**
 * Build appear times for chat-story video / replay.
 * @returns {{ appear: number[], indicators: (object|null)[], duration: number }}
 */
export const buildChatTimeline = (
  messages,
  { leadIn = 1, tail = 2.5, afterGap = AFTER_MESSAGE_GAP } = {}
) => {
  const appear = [];
  const indicators = [];
  let t = leadIn;
  messages.forEach((msg, i) => {
    const ind = messageIndicator(msg);
    if (ind) {
      indicators.push({
        start: t,
        end: t + ind.duration,
        kind: ind.kind,
        self: ind.self,
      });
      t += ind.duration;
    } else {
      indicators.push(null);
    }
    appear.push(t);
    if (i < messages.length - 1) t += afterGap;
  });
  return { appear, indicators, duration: (messages.length ? t : leadIn) + tail };
};

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// Voice-note label, WhatsApp-style "0:05" / "1:03".
export const formatAudioDuration = (sec) => {
  const total = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

// Fake hold-to-record limits (seconds).
export const AUDIO_MIN_SEC = 0.5;
export const AUDIO_MAX_SEC = 60;

// One reply per line; blank lines dropped; at most three (WhatsApp-style).
export const parseReplies = (draft) =>
  String(draft ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

// Elements with the "no-export" class (sender toggle, menus, overlays) are left
// out of screenshots and videos.
const exportFilter = (node) => !node.classList?.contains("no-export");

// Font CSS is embedded once and reused, so Roboto shows up in exports
// without re-downloading it for every video frame.
let fontEmbedCSS;
export const exportOptions = async (node, extra = {}) => {
  if (fontEmbedCSS === undefined) {
    try {
      fontEmbedCSS = await getFontEmbedCSS(node);
    } catch {
      fontEmbedCSS = "";
    }
  }
  return { filter: exportFilter, fontEmbedCSS, ...extra };
};

export const downloadUrl = (url, filename) => {
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
};

// Load an image file, scale it down (max 1280px) and return a data URL.
// Data URLs keep screenshots/videos reliable, and the smaller size keeps
// video frames fast to render.
const MAX_IMAGE_SIDE = 1280;
export const loadImageFile = (file) =>
  new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Not an image"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; // transparent PNGs get a white background, like WhatsApp
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve({ src: canvas.toDataURL("image/jpeg", 0.9), width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });

// Exports render a copy of the page, and that copy loses the chat's scroll
// position (it would show the oldest messages). This pins the current scroll
// with a transform while `fn` runs, so the export shows what you see.
export const withPinnedScroll = async (phoneEl, fn) => {
  const box = phoneEl.querySelector(".chatMessages");
  const inner = box?.querySelector(".chatInner");
  if (!inner) return fn();
  const top = box.scrollTop;
  inner.style.transform = `translateY(${-top}px)`;
  box.scrollTop = 0;
  try {
    return await fn();
  } finally {
    inner.style.transform = "";
    box.scrollTop = top;
  }
};
