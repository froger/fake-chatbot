import React, { useContext, useEffect, useRef } from "react";
import { AppContext } from "../../App";
import { toPng } from "html-to-image";
import {
  sleep,
  exportOptions,
  downloadUrl,
  withPinnedScroll,
  AFTER_MESSAGE_GAP,
  messageIndicator,
} from "../../utils";
import "./index.css";


const Icon = ({ d }) => (
  <svg className="menuIcon" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d={d} />
  </svg>
);

const icons = {
  camera:
    "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM9 2 7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9Zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z",
  video:
    "M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z",
  replay:
    "M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8Z",
  clear:
    "M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z",
  help: "M11 18h2v-2h-2v2Zm1-16a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm0-14a4 4 0 0 0-4 4h2a2 2 0 1 1 4 0c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 0 0-4-4Z",
  code: "M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4Zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4Z",
};

const Menu = () => {
  const {
    isMenuOpen,
    messageList,
    setShowLoading,
    setLoadPercent,
    appRef,
    setMessageList,
    playBip,
    setIsMenuOpen,
    setShowHelp,
    recordingRef,
    videoAbortRef,
    setPresence,
  } = useContext(AppContext);
  const menuRef = useRef();

  // Close the menu when clicking anywhere outside it.
  useEffect(() => {
    if (!isMenuOpen) return;
    const onDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      if (event.target.closest?.(".menuBtn")) return;
      setIsMenuOpen(false);
    };
    const onKey = (event) => event.key === "Escape" && setIsMenuOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isMenuOpen, setIsMenuOpen]);

  const replayChat = async () => {
    setIsMenuOpen(false);
    const tmpMessageList = [...messageList];
    setMessageList([]);
    setPresence(null);
    for (const message of tmpMessageList) {
      const ind = messageIndicator(message);
      if (ind) {
        setPresence({ kind: ind.kind, self: ind.self });
        await sleep(ind.duration * 1000);
        setPresence(null);
      }
      setMessageList((p) => [...p, message]);
      playBip(message.self === true);
      await sleep(AFTER_MESSAGE_GAP * 1000);
    }
  };

  const takeScreenshot = async () => {
    setIsMenuOpen(false);
    await sleep(250); // let the menu close before capturing
    const options = await exportOptions(appRef.current, { pixelRatio: 2 });
    const image = await withPinnedScroll(appRef.current, () =>
      toPng(appRef.current, options)
    );
    downloadUrl(image, `fake-chat-${Date.now()}.png`);
  };

  const saveVideo = async () => {
    setIsMenuOpen(false);
    if (messageList.length === 0) return;
    const controller = new AbortController();
    videoAbortRef.current = controller;
    recordingRef.current = true;
    setLoadPercent(0);
    setShowLoading(true);
    await sleep(250); // let the menu close first

    try {
      // Loaded on demand: the video encoder library is large.
      const { renderChatVideo } = await import("../../video");
      const { blob, extension } = await renderChatVideo({
        phoneEl: appRef.current,
        messages: [...messageList],
        setMessageList,
        setPresence,
        onProgress: setLoadPercent,
        signal: controller.signal,
      });
      const ext = extension.replace(/^\./, "");
      downloadUrl(URL.createObjectURL(blob), `fake-chat-${Date.now()}.${ext}`);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Video export failed", error);
        alert(
          error.name === "VideoUnsupportedError"
            ? "Your browser can't create videos. Please use a recent Chrome, Edge, Firefox or Safari."
            : "Sorry, the video export failed. Please try again."
        );
      }
    } finally {
      recordingRef.current = false;
      videoAbortRef.current = null;
      setShowLoading(false);
      setLoadPercent(0);
    }
  };

  const clearChat = () => {
    setIsMenuOpen(false);
    setPresence(null);
    setMessageList([]);
  };

  const openHelp = () => {
    setIsMenuOpen(false);
    setShowHelp(true);
  };

  const openRepo = () => {
    setIsMenuOpen(false);
    window.open(
      "https://github.com/AmirPhenomenal/fake-chat",
      "_blank",
      "noopener,noreferrer"
    );
  };

  const empty = messageList.length === 0;
  const items = [
    { label: "Take screenshot", icon: icons.camera, onClick: takeScreenshot },
    { label: "Save video", icon: icons.video, onClick: saveVideo, disabled: empty },
    { label: "Replay chat", icon: icons.replay, onClick: replayChat, disabled: empty },
    { label: "Clear chat", icon: icons.clear, onClick: clearChat, disabled: empty },
    { divider: true },
    { label: "How to use", icon: icons.help, onClick: openHelp },
    { label: "Source code", icon: icons.code, onClick: openRepo },
  ];

  return (
    <div
      ref={menuRef}
      className={`menu no-export ${isMenuOpen ? "showMenu" : ""}`}
      role="menu"
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="menuDivider" />
        ) : (
          <button
            key={item.label}
            className="menuItems"
            role="menuitem"
            onClick={item.onClick}
            disabled={item.disabled}
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <Icon d={item.icon} />
            {item.label}
          </button>
        )
      )}
    </div>
  );
};

export default Menu;
