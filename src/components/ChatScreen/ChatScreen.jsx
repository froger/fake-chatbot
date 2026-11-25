import React, { useContext, useEffect, useRef, useState } from "react";
import "./index.css";
import ChatMessage from "../ChatMessage/ChatMessage";
import { EmojiIcon, AttachIcon, CameraIcon, MicIcon, SendIcon } from "../Icons";
import { AppContext } from "../../App";
import {
  newId,
  nowTime,
  loadImageFile,
  parseReplies,
  formatAudioDuration,
  AUDIO_MIN_SEC,
  AUDIO_MAX_SEC,
} from "../../utils";

const ChatScreen = () => {
  const [chatInput, setChatInput] = useState("");
  // Who the next message is sent as: true = you (right/green), false = them (left).
  const [sendAsSelf, setSendAsSelf] = useState(true);
  const [replyDraft, setReplyDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);

  const { messageList, setMessageList, playBip, lastMessageRef } =
    useContext(AppContext);

  const fileInputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const recordingRef = useRef(null); // { start, sent }
  const tickRef = useRef(null);

  const themReplies = () => {
    if (sendAsSelf) return undefined;
    const replies = parseReplies(replyDraft);
    return replies.length ? replies : undefined;
  };

  const stopTick = () => {
    if (tickRef.current != null) {
      cancelAnimationFrame(tickRef.current);
      tickRef.current = null;
    }
  };

  // Send one or more images. Text in the input becomes the caption of the first one.
  const sendImages = async (files) => {
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    let caption = chatInput.trim() ? chatInput : "";
    const attachedReplies = themReplies();
    let replies = attachedReplies;
    for (const file of images) {
      try {
        const image = await loadImageFile(file);
        const entry = {
          msgId: newId(),
          text: caption,
          image,
          self: sendAsSelf,
          time: nowTime(),
        };
        if (replies) entry.replies = replies;
        setMessageList((list) => [...list, entry]);
        caption = "";
        replies = undefined; // only the first image carries replies
        playBip(sendAsSelf);
      } catch (error) {
        console.error(error);
      }
    }
    setChatInput("");
    if (attachedReplies) setReplyDraft("");
  };

  const onPickFiles = (event) => {
    sendImages(event.target.files);
    event.target.value = ""; // allow picking the same file again
  };

  const onPaste = (event) => {
    const files = [...event.clipboardData.files].filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length) {
      event.preventDefault();
      sendImages(files);
    }
  };

  const dragHandlers = {
    onDragOver: (event) => {
      if ([...event.dataTransfer.types].includes("Files")) {
        event.preventDefault();
        setDragging(true);
      }
    },
    onDragLeave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
    },
    onDrop: (event) => {
      event.preventDefault();
      setDragging(false);
      sendImages(event.dataTransfer.files);
    },
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    const replies = themReplies();
    const entry = {
      msgId: newId(),
      text: chatInput,
      self: sendAsSelf,
      time: nowTime(),
    };
    if (replies) entry.replies = replies;
    setMessageList((list) => [...list, entry]);
    setChatInput("");
    if (replies) setReplyDraft("");
    playBip(sendAsSelf);
  };

  const sendAudio = (durationSec) => {
    const replies = themReplies();
    const entry = {
      msgId: newId(),
      audio: { durationSec },
      self: sendAsSelf,
      time: nowTime(),
    };
    if (replies) entry.replies = replies;
    setMessageList((list) => [...list, entry]);
    if (replies) setReplyDraft("");
    playBip(sendAsSelf);
  };

  const finishRecording = () => {
    const rec = recordingRef.current;
    if (!rec || rec.sent) return;
    rec.sent = true;
    recordingRef.current = null;
    stopTick();
    setRecording(false);
    setRecordSec(0);
    const elapsed = Math.min(
      AUDIO_MAX_SEC,
      (performance.now() - rec.start) / 1000
    );
    if (elapsed < AUDIO_MIN_SEC) return;
    sendAudio(Math.round(elapsed * 10) / 10);
  };

  const tickRecording = () => {
    const rec = recordingRef.current;
    if (!rec || rec.sent) return;
    const elapsed = (performance.now() - rec.start) / 1000;
    if (elapsed >= AUDIO_MAX_SEC) {
      setRecordSec(AUDIO_MAX_SEC);
      finishRecording();
      return;
    }
    setRecordSec(elapsed);
    tickRef.current = requestAnimationFrame(tickRecording);
  };

  const onMicPointerDown = (event) => {
    if (chatInput) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    stopTick();
    recordingRef.current = { start: performance.now(), sent: false };
    setRecording(true);
    setRecordSec(0);
    tickRef.current = requestAnimationFrame(tickRecording);
  };

  const onMicPointerUp = () => {
    if (!recordingRef.current) return;
    finishRecording();
  };

  useEffect(() => () => stopTick(), []);

  // Enter sends, Shift+Enter adds a new line.
  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chatScreen" {...dragHandlers}>
      {dragging && (
        <div className="dropOverlay no-export">Drop image to send</div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onPickFiles}
      />
      <div className="chatMessages">
        <div className="chatInner">
        {messageList.length === 0 && !recording && (
          <div className="emptyHint no-export">
            Type a message below and press <kbd>Enter</kbd>.
            <br />
            Send images with the 📎 or camera icon, or paste / drop them here.
            <br />
            Hold the mic to send a voice note (release to finish).
            <br />
            Use the <b>You / Them</b> switch to pick the sender, or
            double-click any bubble to flip it.
            <br />
            As <b>Them</b>, add up to three quick replies (one per line).
          </div>
        )}
        {messageList.length > 0 && <div className="dayChip">Today</div>}
        {messageList.map((message, index) => (
          <ChatMessage
            text={message.text}
            image={message.image}
            audio={message.audio}
            time={message.time}
            replies={message.replies}
            key={message.msgId}
            msgId={message.msgId}
            left={message.self !== true}
            first={index === 0 || messageList[index - 1].self !== message.self}
            componentRef={index === messageList.length - 1 ? lastMessageRef : null}
          />
        ))}
        </div>
      </div>

      {!sendAsSelf && (
        <textarea
          className="replyBox no-export"
          rows={Math.min(3, Math.max(1, replyDraft.split("\n").length))}
          value={replyDraft}
          placeholder="Quick replies (one per line)"
          onChange={(e) => setReplyDraft(e.target.value)}
          aria-label="Quick replies, one per line, up to three"
          title="One reply per line. Up to three. Hidden in screenshots/videos."
        />
      )}

      {recording && (
        <div className="recordBar no-export" aria-live="polite">
          <span className="recordDot" />
          <span className="recordTime">{formatAudioDuration(recordSec)}</span>
          <span className="recordHint">Release to send</span>
        </div>
      )}

      <div className="chatBar">
        <button
          className={`senderToggle no-export ${sendAsSelf ? "self" : "other"}`}
          onClick={() => setSendAsSelf((s) => !s)}
          title="Switch who sends the next message (hidden in screenshots/videos)"
          aria-label={`Sending as ${sendAsSelf ? "you" : "them"}. Click to switch.`}
        >
          <span className="senderKnob" />
          <span className="senderLabel">{sendAsSelf ? "You" : "Them"}</span>
        </button>
        <div className="chatInput">
          <EmojiIcon className="barIcon emojiIcon" />
          <textarea
            className="chatBox"
            rows={Math.min(5, chatInput.split("\n").length)}
            value={chatInput}
            placeholder="Message"
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
          <button
            className="barBtn"
            onClick={() => fileInputRef.current.click()}
            title="Send an image (text in the box becomes its caption)"
            aria-label="Attach image"
          >
            <AttachIcon className="barIcon attachIcon" />
          </button>
          {!chatInput && (
            <button
              className="barBtn"
              onClick={() => fileInputRef.current.click()}
              title="Send an image"
              aria-label="Send photo"
            >
              <CameraIcon className="barIcon cameraIcon" />
            </button>
          )}
        </div>
        <button
          className={`sendBtn ${recording ? "recording" : ""}`}
          onClick={chatInput ? sendMessage : undefined}
          onPointerDown={chatInput ? undefined : onMicPointerDown}
          onPointerUp={chatInput ? undefined : onMicPointerUp}
          onPointerCancel={chatInput ? undefined : onMicPointerUp}
          onLostPointerCapture={chatInput ? undefined : onMicPointerUp}
          aria-label={chatInput ? "Send" : "Hold to record voice note"}
          title={
            chatInput
              ? "Send"
              : "Hold to record a voice note (release to send)"
          }
        >
          {chatInput ? (
            <SendIcon className="sendIcon" />
          ) : (
            <MicIcon className="micIcon" />
          )}
        </button>
      </div>
    </div>
  );
};

export default ChatScreen;
