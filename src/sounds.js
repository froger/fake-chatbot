// Inlined as a data URL so it can always be decoded (no extra request).
import sendUrl from "./messageSend.mp3?inline";

// Sent messages use the bundled "pop" sound. Received messages get a short,
// soft two-note "blip" made with Web Audio, so no extra asset is needed.

let liveCtx;
let liveSendBuffer;

const getLiveCtx = () => {
  if (!liveCtx) liveCtx = new (window.AudioContext || window.webkitAudioContext)();
  return liveCtx;
};

const loadSendBuffer = async (audioCtx) => {
  const data = await fetch(sendUrl).then((r) => r.arrayBuffer());
  return audioCtx.decodeAudioData(data);
};

const scheduleSend = (audioCtx, buffer, when) => {
  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  source.buffer = buffer;
  gain.gain.value = 0.7;
  source.connect(gain).connect(audioCtx.destination);
  source.start(when);
};

const scheduleReceive = (audioCtx, when) => {
  [
    [987.77, 0], // B5
    [1318.51, 0.075], // E6
  ].forEach(([freq, offset]) => {
    const t = when + offset;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });
};

/** Play the sound for a new message: `self` = sent by you, otherwise received. */
export const playMessageSound = async (self) => {
  try {
    const ctx = getLiveCtx();
    if (ctx.state === "suspended") await ctx.resume();
    if (self) {
      liveSendBuffer ??= loadSendBuffer(ctx);
      scheduleSend(ctx, await liveSendBuffer, ctx.currentTime);
    } else {
      scheduleReceive(ctx, ctx.currentTime);
    }
  } catch {
    /* audio blocked or unsupported: stay silent */
  }
};

/**
 * Render the sounds of a whole chat replay into one AudioBuffer, for the video.
 * @param {{time: number, self: boolean}[]} events - when each message appears (seconds)
 */
export const renderTimelineAudio = async (events, duration, sampleRate = 48000) => {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const sendBuffer = await loadSendBuffer(ctx);
  events.forEach(({ time, self }) =>
    self ? scheduleSend(ctx, sendBuffer, time) : scheduleReceive(ctx, time)
  );
  return ctx.startRendering();
};
