import { createContext, useEffect, useRef, useState } from "react";
import "./App.css";

import { SignalIcon, WifiIcon, BatteryIcon } from "./components/Icons";

import { playMessageSound } from "./sounds";
import ChatScreen from "./components/ChatScreen/ChatScreen";
import Loading from "./components/Loading/Loading";
import Menu from "./components/Menu/Menu";
import AppBar from "./components/AppBar/AppBar";
import Help from "./components/Help/Help";

const HELP_SEEN_KEY = "fake-chat:help-seen";

const readHelpSeen = () => {
  try {
    return localStorage.getItem(HELP_SEEN_KEY) === "1";
  } catch {
    return false;
  }
};

export const AppContext = createContext();
function App() {
  const appRef = useRef();
  const lastMessageRef = useRef();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [messageList, setMessageList] = useState([]);
  const [showLoading, setShowLoading] = useState(false);
  const [loadPercent, setLoadPercent] = useState(0);
  const [showHelp, setShowHelp] = useState(() => !readHelpSeen());
  const [clockText, setClockText] = useState(() =>
    new Date()
      .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      .replace(/\s?[AP]M$/i, "")
  );

  const closeHelp = () => {
    setShowHelp(false);
    try {
      localStorage.setItem(HELP_SEEN_KEY, "1");
    } catch {
      /* storage unavailable: guide just shows again next visit */
    }
  };

  // `self`: true for your messages (send sound), false for theirs (receive blip).
  const playBip = (self = true) => playMessageSound(self);

  // True while a video is being rendered (it controls scrolling itself).
  const recordingRef = useRef(false);
  const videoAbortRef = useRef(null);

  useEffect(() => {
    if (recordingRef.current) return;
    lastMessageRef?.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messageList]);

  return (
    <AppContext.Provider
      value={{
        messageList,
        setMessageList,
        playBip,
        isMenuOpen,
        setShowLoading,
        setLoadPercent,
        appRef,
        setIsMenuOpen,
        loadPercent,
        lastMessageRef,
        setShowHelp,
        closeHelp,
        recordingRef,
        videoAbortRef,
      }}
    >
      <div className="conntainer">
        {showHelp && <Help />}
        {showLoading && <Loading />}
        <Menu />
        <div className="phone" ref={appRef}>
          <div className="statusBar">
            <input
              className="statusTime"
              value={clockText}
              onChange={(e) => setClockText(e.target.value)}
              aria-label="Phone clock"
              title="Click to edit the phone clock"
              spellCheck={false}
            />
            <div className="statusIcons">
              <WifiIcon />
              <SignalIcon />
              <BatteryIcon />
            </div>
          </div>
          <AppBar />
          <ChatScreen />
        </div>
      </div>
    </AppContext.Provider>
  );
}

export default App;
