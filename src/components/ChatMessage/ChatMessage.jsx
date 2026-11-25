import React, { useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "../../App";
import { ReplyIcon, PlayIcon, MicIcon, DEFAULT_AVATAR } from "../Icons";
import { newId, nowTime, formatAudioDuration, BUBBLE_IN_SEC } from "../../utils";
import "./index.css";

const Ticks = () => (
  <svg className="ticks" viewBox="0 0 16 11" aria-hidden="true">
    <path
      fill="currentColor"
      d="M11.07.65 10.4.12a.4.4 0 0 0-.56.07L4.7 6.62 2.33 4.4a.4.4 0 0 0-.56.02l-.6.64a.4.4 0 0 0 .02.57l3.2 3a.4.4 0 0 0 .59-.05l6.16-7.36a.4.4 0 0 0-.07-.57Z"
    />
    <path
      fill="currentColor"
      d="m15.07.65-.67-.53a.4.4 0 0 0-.56.07L8.7 6.62l-.85-.8-.92 1.1 1.5 1.42a.4.4 0 0 0 .59-.05l6.16-7.36a.4.4 0 0 0-.07-.57Z"
    />
  </svg>
);

/* Seeded RNG so each message gets a stable but unique wave. */
const hashSeed = (msgId) => {
  const s = String(msgId ?? "wave");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/*
 * WhatsApp-like voice bars: syllable hills + short valleys between.
 * Dense (no blank gaps), mid peaks (no clip/shout), seeded by msgId.
 */
const buildWaveform = (msgId, samples = 34) => {
  const rand = mulberry32(hashSeed(msgId));
  const out = Array.from({ length: samples }, () => 0.14 + rand() * 0.08);
  let i = 1 + Math.floor(rand() * 2);

  while (i < samples - 1) {
    const len = 3 + Math.floor(rand() * 5); // 3–7 bars per syllable
    const peak = 0.42 + rand() * 0.32; // 0.42–0.74
    for (let b = 0; b < len && i < samples - 1; b++, i++) {
      const edge = Math.min(b + 0.5, len - b - 0.5) / (len / 2);
      const shape = Math.sin((Math.PI / 2) * Math.min(1, edge));
      out[i] = Math.min(0.78, Math.max(0.14, peak * shape * (0.88 + rand() * 0.24)));
    }
    const gap = 1 + Math.floor(rand() * 2); // 1–2 short valley bars
    for (let g = 0; g < gap && i < samples - 1; g++, i++) {
      out[i] = 0.12 + rand() * 0.16;
    }
  }
  return out;
};

const ChatMessage = ({
  left,
  first,
  last,
  text,
  image,
  audio,
  time,
  msgId,
  replies,
  componentRef,
}) => {
  const { setMessageList, playBip } = useContext(AppContext);

  // Double-click (or double-tap) a bubble to move it to the other side.
  const messageClick = (event) => {
    if (event.detail === 2) {
      setMessageList((list) =>
        list.map((message) =>
          message.msgId === msgId ? { ...message, self: !message.self } : message
        )
      );
    }
  };

  const sendReply = (reply) => {
    setMessageList((list) => [
      ...list,
      {
        msgId: newId(),
        text: reply,
        self: true,
        time: nowTime(),
        fromReply: true, // no typing indicator on replay/video
      },
    ]);
    playBip(true);
  };

  const meta = (
    <span className="meta">
      {time}
      {!left && <Ticks />}
    </span>
  );

  // WhatsApp shows very tall/wide photos cropped to a sensible shape.
  const ratio = image
    ? Math.min(Math.max(image.width / image.height, 0.62), 1.9)
    : 1;

  const showReplies = left && Array.isArray(replies) && replies.length > 0;
  const waveSpikes = audio ? buildWaveform(msgId) : null;
  const blockRef = useRef(null);
  // Quick replies stay inert until bubbleIn finishes (incl. audio + replies).
  const [repliesReady, setRepliesReady] = useState(false);

  const setBlockRef = (node) => {
    blockRef.current = node;
    if (componentRef) componentRef.current = node;
  };

  useEffect(() => {
    if (!showReplies) {
      setRepliesReady(false);
      return;
    }
    setRepliesReady(false);
    const el = blockRef.current;
    let done = false;
    const unlock = () => {
      if (done) return;
      done = true;
      setRepliesReady(true);
    };
    const onEnd = (e) => {
      if (e.target === el && e.animationName === "bubbleIn") unlock();
    };
    el?.addEventListener("animationend", onEnd);
    const t = setTimeout(unlock, Math.ceil(BUBBLE_IN_SEC * 1000) + 40);
    return () => {
      el?.removeEventListener("animationend", onEnd);
      clearTimeout(t);
    };
  }, [showReplies, msgId]);

  return (
    <div
      className={`messageBlock ${left ? "blockLeft" : "blockRight"} ${
        first ? "first" : ""
      } ${showReplies ? "hasReplies" : ""}`}
      ref={setBlockRef}
    >
      <div
        onClick={messageClick}
        className={`message ${left ? "ml" : "mr"} ${first ? "first" : ""} ${
          last ? "last" : ""
        } ${image ? "imageMsg" : ""} ${audio ? "audioMsg" : ""}`}
        title="Double-click to switch sides"
      >
        {image ? (
          <>
            <div className="photo" style={{ aspectRatio: ratio }}>
              <img src={image.src} alt="" draggable={false} />
              {!text && <span className="photoMeta">{meta}</span>}
            </div>
            {text && (
              <div className="caption">
                <span className="messageText">{text}</span>
                {meta}
              </div>
            )}
          </>
        ) : audio ? (
          <div
            className={`voiceNote ${left ? "voiceIncoming" : "voiceOutgoing"}`}
          >
            <div className="voicePlayCol">
              <span className="voicePlay" aria-hidden="true">
                <PlayIcon className="voicePlayIcon" />
              </span>
            </div>
            <div className="voiceWave" aria-hidden="true">
              <span className="voiceScrub" />
              {waveSpikes.map((h, i) => (
                <span
                  key={i}
                  className="voiceSpike"
                  style={{ height: `${Math.round(h * 100)}%` }}
                />
              ))}
            </div>
            <div className="voiceAvatar">
              <img src={DEFAULT_AVATAR} alt="" draggable={false} />
              <MicIcon className="voiceMicIcon" aria-hidden="true" />
            </div>
            <div className="voiceFooter">
              <span className="voiceDuration">
                {formatAudioDuration(audio.durationSec)}
              </span>
              {meta}
            </div>
          </div>
        ) : (
          <>
            <span className="messageText">{text}</span>
            {meta}
          </>
        )}
      </div>
      {showReplies && (
        <div className="quickReplies">
          {replies.map((reply, index) => (
            <button
              key={`${index}-${reply}`}
              type="button"
              className="quickReply"
              disabled={!repliesReady}
              onClick={() => sendReply(reply)}
            >
              <ReplyIcon className="quickReplyIcon" />
              <span className="quickReplyText">{reply}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
