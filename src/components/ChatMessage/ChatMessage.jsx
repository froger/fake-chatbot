import React, { useContext } from "react";
import { AppContext } from "../../App";
import { ReplyIcon } from "../Icons";
import { newId, nowTime } from "../../utils";
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

const ChatMessage = ({
  left,
  first,
  text,
  image,
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
      { msgId: newId(), text: reply, self: true, time: nowTime() },
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

  return (
    <div
      className={`messageBlock ${left ? "blockLeft" : "blockRight"} ${
        first ? "first" : ""
      } ${showReplies ? "hasReplies" : ""}`}
      ref={componentRef || undefined}
    >
      <div
        onClick={messageClick}
        className={`message ${left ? "ml" : "mr"} ${first ? "first" : ""} ${
          image ? "imageMsg" : ""
        } ${showReplies ? "withReplies" : ""}`}
        title="Double-click to switch sides"
      >
        <div className="messageBody">
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
                onClick={(event) => {
                  event.stopPropagation();
                  sendReply(reply);
                }}
              >
                <ReplyIcon className="quickReplyIcon" />
                <span className="quickReplyText">{reply}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
