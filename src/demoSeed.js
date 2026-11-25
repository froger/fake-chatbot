import { newId } from "./utils";

/**
 * Sample chat matching Wikimedia WhatsApp Android dark screenshot
 * (contact Tiffany) plus a voice note and Business-style quick replies
 * for side-by-side fidelity checks: /?demo=1
 */
export const isDemoMode = () => {
  try {
    return new URLSearchParams(window.location.search).has("demo");
  } catch {
    return false;
  }
};

export const demoContact = {
  nickname: "Tiffany",
  status: "online",
};

export const buildDemoMessages = () => [
  { msgId: newId(), text: "Hello!", self: false, time: "2:51 PM" },
  { msgId: newId(), text: "Hello! 👋", self: true, time: "2:51 PM" },
  { msgId: newId(), text: "How is it going?", self: false, time: "2:51 PM" },
  { msgId: newId(), text: "I'm fine, and you?", self: true, time: "2:52 PM" },
  { msgId: newId(), text: "Me too 🥰", self: false, time: "2:52 PM" },
  {
    msgId: newId(),
    text: "Would you like to go out with me?",
    self: false,
    time: "2:52 PM",
  },
  { msgId: newId(), text: "Of course! 😍", self: true, time: "2:53 PM" },
  {
    msgId: newId(),
    text: "Good! See you later ❤️",
    self: false,
    time: "2:53 PM",
  },
  // Voice note (WA layout check) + interactive reply buttons
  {
    msgId: newId(),
    audio: { durationSec: 8 },
    self: false,
    time: "2:54 PM",
    replies: ["On my way", "Running late", "Call me"],
  },
  {
    msgId: newId(),
    audio: { durationSec: 5 },
    self: true,
    time: "2:55 PM",
  },
];
