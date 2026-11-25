import React, { useContext, useState } from "react";
import { AppContext } from "../../App";
import {
  BackIcon,
  VideoIcon,
  CallIcon,
  MoreIcon,
  DEFAULT_AVATAR,
} from "../Icons";
import "./index.css";

const AppBar = () => {
  const { isMenuOpen, setIsMenuOpen, presence, demoContact } =
    useContext(AppContext);
  const [pp, setPp] = useState(DEFAULT_AVATAR);
  const [nickname, setNickname] = useState(
    () => demoContact?.nickname ?? "Nickname"
  );
  const [status, setStatus] = useState(() => demoContact?.status ?? "online");

  const menuClick = (event) => {
    event.stopPropagation();
    setIsMenuOpen((p) => !p);
  };

  const avatarChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setPp(URL.createObjectURL(event.target.files[0]));
    }
  };

  // App bar only shows recording (typing uses the chat bubble instead).
  const themRecording =
    presence && presence.self !== true && presence.kind === "recording"
      ? "recording audio..."
      : null;

  return (
    <div className="appBar">
      <div className="appBarLeft">
        <BackIcon className="arrow" />
        <label htmlFor="pp" className="ppLabel" title="Change profile picture">
          <img src={pp} alt="Profile" className="ppImage" />
        </label>
        <input id="pp" type="file" accept="image/*" onChange={avatarChange} />
        <div className="nameBlock">
          <input
            className="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            title="Click to edit the contact name"
            aria-label="Contact name"
            spellCheck={false}
          />
          {themRecording ? (
            <span className="presenceStatus recording">{themRecording}</span>
          ) : (
            <input
              className={`contactStatus ${status ? "" : "no-export"}`}
              type="text"
              placeholder="add status (optional)"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              title="Click to edit the status line (leave empty to hide)"
              aria-label="Contact status"
              spellCheck={false}
            />
          )}
        </div>
      </div>
      <div className="appBarRight">
        <VideoIcon className="appBarIcons" />
        <CallIcon className="appBarIcons" />
        <button
          className={`menuBtn ${isMenuOpen ? "open" : ""}`}
          onClick={menuClick}
          aria-label="Open menu"
          title="Menu: screenshot, video, replay"
        >
          <MoreIcon className="appBarIcons" />
        </button>
      </div>
    </div>
  );
};

export default AppBar;
