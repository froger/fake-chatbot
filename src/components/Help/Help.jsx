import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "../../App";
import "./index.css";

/* Small animated scenes, one per step. Pure CSS animations, no assets. */

const WelcomeScene = () => (
  <div className="scene sceneWelcome">
    <div className="miniPhone">
      <div className="miniBar">
        <span className="miniAvatar" />
        <span className="miniName" />
      </div>
      <div className="miniChat">
        <div className="mb in d1">Hey! 👋</div>
        <div className="mb out d2">Is this real?</div>
        <div className="mb in d3">Nope, made with Fake Chat 😄</div>
        <div className="mb out d4">🎬 Saving as video…</div>
      </div>
    </div>
  </div>
);

const ProfileScene = () => (
  <div className="scene">
    <div className="miniHeader">
      <span className="miniArrow">←</span>
      <span className="miniAvatar big pulseRing" />
      <div className="miniNameCol">
        <span className="typing">Alex</span>
        <span className="miniStatus">online</span>
      </div>
      <span className="miniDots pulseRing delay">⋮</span>
    </div>
    <div className="callouts">
      <span className="callout c1">📷 Tap photo to upload</span>
      <span className="callout c2">✏️ Tap name and status to edit</span>
    </div>
  </div>
);

const TypeScene = () => (
  <div className="scene">
    <div className="miniChatArea">
      <div className="mb out sendLoop">See you at 8?</div>
    </div>
    <div className="miniInput">
      <span className="miniToggle">You</span>
      <span className="miniField">
        <span className="typeLoop">See you at 8?</span>
        <span className="caret" />
      </span>
      <span className="miniSend">➤</span>
    </div>
    <div className="keys">
      <kbd>Enter</kbd> send <span className="sep">·</span> <kbd>Shift</kbd> +{" "}
      <kbd>Enter</kbd> new line
    </div>
  </div>
);

const SwitchScene = () => (
  <div className="scene">
    <div className="miniChatArea tall">
      <div className="flipBubble">
        I’m the other person now!
        <span className="tap" />
        <span className="tap second" />
      </div>
    </div>
    <div className="switchRow">
      <span className="miniSwitch">
        <span className="knob" />
      </span>
      <span>
        Or flip the <b>You / Them</b> switch before you type
      </span>
    </div>
  </div>
);

const ExportScene = () => (
  <div className="scene">
    <div className="miniMenu">
      <div className="mi m1">
        <span>📸</span>Take screenshot<em>PNG</em>
      </div>
      <div className="mi m2">
        <span>🎬</span>Save video<em>replays the chat</em>
      </div>
      <div className="mi m3">
        <span>🔁</span>Replay chat<em>typing + timing</em>
      </div>
      <div className="mi m4">
        <span>❔</span>How to use<em>this guide</em>
      </div>
    </div>
    <div className="flash" />
  </div>
);

const steps = [
  {
    title: "Fake Chat",
    text: "Build a WhatsApp-style conversation in seconds, then save it as a screenshot or a chat-story video.",
    Scene: WelcomeScene,
  },
  {
    title: "Set up the contact",
    text: "Click the profile picture to upload any image. Click the name or status line to type your own.",
    Scene: ProfileScene,
  },
  {
    title: "Write messages",
    text: "Type in the box at the bottom and press Enter or the green button. Shift + Enter adds a new line. To send a photo, click the 📎 or camera icon, or paste / drop an image. Text in the box becomes its caption. Hold the mic to send a voice note; release when you’re done (up to 60 seconds).",
    Scene: TypeScene,
  },
  {
    title: "Switch who’s talking",
    text: "Double-click (or double-tap) any bubble to move it to the other side. Or use the You / Them switch next to the input. The switch never appears in exports.",
    Scene: SwitchScene,
  },
  {
    title: "Export it",
    text: "Open the ⋮ menu at the top right to take a screenshot, record a video, replay the chat or clear it. Replay and video show typing or recording indicators timed to each message (quick replies appear instantly). You can reopen this guide there anytime.",
    Scene: ExportScene,
  },
];

const Help = () => {
  const { closeHelp } = useContext(AppContext);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const last = step === steps.length - 1;

  const go = (next) => {
    if (next < 0) return;
    if (next >= steps.length) return closeHelp();
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") go(step + 1);
      else if (e.key === "ArrowLeft") go(step - 1);
      else if (e.key === "Escape") closeHelp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const { title, text, Scene } = steps[step];

  return (
    <div
      className="help no-export"
      role="dialog"
      aria-modal="true"
      aria-label="How to use Fake Chat"
    >
      <div className="helpCard">
        <button className="skip" onClick={closeHelp}>
          Skip
        </button>

        <div
          key={step}
          className={`stepBody ${dir > 0 ? "fromRight" : "fromLeft"}`}
        >
          <Scene />
          <h2>{title}</h2>
          <p>{text}</p>
        </div>

        <div className="helpFooter">
          <button
            className="navBtn ghost"
            onClick={() => go(step - 1)}
            style={{ visibility: step === 0 ? "hidden" : "visible" }}
          >
            Back
          </button>
          <div className="dots">
            {steps.map((_, i) => (
              <button
                key={i}
                className={`dot ${i === step ? "active" : ""}`}
                onClick={() => go(i)}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>
          <button className="navBtn primary" onClick={() => go(step + 1)}>
            {last ? "Start chatting" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Help;
