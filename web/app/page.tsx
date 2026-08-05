"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ApiHistoryItem = { role: string; content: string };
type UiState = "idle" | "listening" | "thinking" | "found";

const AI_SERVICE_URL = "http://localhost:8000";

const SUGGESTIONS = [
  "Run a systems check",
  "Help me think through a decision",
  "Explain something complicated, simply",
];

interface MinimalSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { transcript: string }[][] }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

const BATTLE_OFF = /\b(deactivate|disengage|stand\s*down|normal\s*mode)\b|\bbattle\s*mode\b.{0,10}\boff\b|\bexit\b.{0,10}\bbattle\s*mode\b/i;
const BATTLE_ON = /\b(activate|engage|enable)\b.{0,15}\bbattle\s*mode\b|\bbattle\s*mode\b.{0,10}\bon\b/i;

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [apiHistory, setApiHistory] = useState<ApiHistoryItem[]>([]);
  const [input, setInput] = useState("");
  const [uiState, setUiState] = useState<UiState>("idle");
  const [battleMode, setBattleMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("");
  const [showVoicePicker, setShowVoicePicker] = useState(false);

  const dataState = battleMode ? "battle" : uiState;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, uiState]);

  // List available voices, default to the best guess but let the user override
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    function loadVoices() {
      const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      setAvailableVoices(voices);

      // Prefer known higher-quality network voices (Chrome's "Google" voices)
      // over local SAPI/offline ones, which tend to sound more robotic
      const best =
        voices.find((v) => /google/i.test(v.name) && /female/i.test(v.name)) ||
        voices.find((v) => /google us english/i.test(v.name)) ||
        voices.find((v) => /samantha|zira|victoria|susan/i.test(v.name)) ||
        voices.find((v) => /google/i.test(v.name)) ||
        voices[0];

      if (best) {
        voiceRef.current = best;
        setSelectedVoiceURI(best.voiceURI);
      }
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  function selectVoice(uri: string) {
    setSelectedVoiceURI(uri);
    const v = availableVoices.find((v) => v.voiceURI === uri);
    if (v) voiceRef.current = v;
  }

  function previewVoice(v: SpeechSynthesisVoice) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Hello. I'm Jarvis. This is how I sound.");
    u.voice = v;
    window.speechSynthesis.speak(u);
  }

  const speak = useCallback(
    (text: string) => {
      if (!voiceOn || typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) utterance.voice = voiceRef.current;
      utterance.rate = battleMode ? 1.1 : 1.0;
      utterance.pitch = battleMode ? 0.9 : 1.05;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [voiceOn, battleMode]
  );

  function stopSpeaking() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return;

    // Local command handling — never hits the backend
    if (BATTLE_OFF.test(text)) {
      setBattleMode(false);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: "Standing down." },
      ]);
      speak("Standing down.");
      setInput("");
      return;
    }
    if (BATTLE_ON.test(text)) {
      setBattleMode(true);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: "Battle mode engaged." },
      ]);
      speak("Battle mode engaged.");
      setInput("");
      return;
    }

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setError(null);
    setUiState("thinking");

    try {
      const res = await fetch(`${AI_SERVICE_URL}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: apiHistory }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const data: { answer: string } = await res.json();

      setUiState("found");
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
      setApiHistory((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: data.answer },
      ]);
      if (data.answer) speak(data.answer);
      setTimeout(() => setUiState("idle"), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setUiState("idle");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function toggleMic() {
    if (typeof window === "undefined") return;
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => MinimalSpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => MinimalSpeechRecognition }).webkitSpeechRecognition;

    if (!Ctor) {
      setError("Voice input isn't supported in this browser — try Chrome or Edge.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      setUiState("idle");
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript;
      sendMessage(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setUiState("listening");
  }

  const stateLabel = {
    idle: "STANDING BY",
    listening: "LISTENING",
    thinking: "PROCESSING",
    found: "COMPLETE",
  }[uiState];

  return (
    <div data-state={dataState} className="min-h-screen relative">
      <div className="hud-bg" />
      <main className="relative z-10 min-h-screen flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-2xl flex flex-col flex-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="display-font text-2xl font-bold glow-text tracking-widest">
                J.A.R.V.I.S.
              </h1>
              <p className="text-xs tracking-[0.3em] mt-1" style={{ color: "var(--glow)" }}>
                {battleMode ? "⚠ BATTLE PROTOCOL ACTIVE" : stateLabel}
                <span className="blink">_</span>
              </p>
            </div>
            <div className="flex items-center gap-2 relative">
              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  className="panel px-3 py-1.5 text-xs display-font tracking-wider glow-text"
                >
                  ■ STOP
                </button>
              )}
              <button
                onClick={() => setShowVoicePicker((s) => !s)}
                className="panel px-3 py-1.5 text-xs display-font tracking-wider"
                style={{ color: "#5a6a72" }}
                title="Choose voice"
              >
                ⚙
              </button>
              <button
                onClick={() => setVoiceOn((v) => !v)}
                className="panel px-3 py-1.5 text-xs display-font tracking-wider"
                style={{ color: voiceOn ? "var(--glow-bright)" : "#5a6a72" }}
              >
                VOICE {voiceOn ? "ON" : "OFF"}
              </button>

              {showVoicePicker && (
                <div
                  className="panel absolute top-10 right-0 w-72 p-3 flex flex-col gap-2 max-h-80 overflow-y-auto scroll-thin z-20"
                  style={{ background: "rgba(5,10,14,0.97)" }}
                >
                  <p className="text-xs tracking-widest mb-1" style={{ color: "var(--glow)" }}>
                    SELECT VOICE
                  </p>
                  {availableVoices.length === 0 && (
                    <p className="text-xs" style={{ color: "#5a6a72" }}>
                      No voices found — your browser may need a moment, try reopening this menu.
                    </p>
                  )}
                  {availableVoices.map((v) => (
                    <div key={v.voiceURI} className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => selectVoice(v.voiceURI)}
                        className="text-left text-xs flex-1 truncate"
                        style={{
                          color: v.voiceURI === selectedVoiceURI ? "var(--glow-bright)" : "#8fa4ad",
                        }}
                      >
                        {v.voiceURI === selectedVoiceURI ? "● " : "○ "}
                        {v.name}
                      </button>
                      <button
                        onClick={() => previewVoice(v)}
                        className="text-xs px-2 py-0.5 rounded hover:bg-white/10"
                        style={{ color: "var(--glow)" }}
                      >
                        ▶
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Core indicator */}
          <div className="flex justify-center mb-8">
            <div className="core">
              <div className="core-ring" />
              <div className="core-ring r2" />
              <div className="core-ring r3" />
              <div className="scan-sweep" />
              <div className="core-inner" />
            </div>
          </div>

          {/* Conversation panel */}
          <div className="panel p-4 flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto scroll-thin max-h-[380px] flex flex-col gap-4 pr-1">
              {messages.length === 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs tracking-widest" style={{ color: "var(--glow)" }}>
                    SUGGESTED QUERIES
                  </p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-left text-sm px-3 py-2 rounded hover:bg-white/5 transition"
                      style={{ color: "#8fa4ad" }}
                    >
                      &gt; {s}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((msg, i) =>
                msg.role === "user" ? (
                  <div key={i} className="text-sm" style={{ color: "#7d8f97" }}>
                    <span style={{ color: "var(--glow)" }}>YOU &gt;</span> {msg.content}
                  </div>
                ) : (
                  <div key={i} className="text-sm leading-relaxed glow-text">
                    <span style={{ color: "var(--glow)" }}>JARVIS &gt;</span> {msg.content}
                  </div>
                )
              )}

              {uiState === "thinking" && (
                <div className="text-sm glow-text flex items-center gap-2">
                  <span>ANALYZING</span>
                  <span className="blink">_</span>
                </div>
              )}

              {error && (
                <div className="text-sm px-3 py-2 rounded" style={{ color: "#ff6b6b", background: "rgba(255,0,0,0.08)" }}>
                  ERR &gt; {error}
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="panel p-3 flex items-center gap-3 mt-4 sticky bottom-6">
            <button
              type="button"
              onClick={toggleMic}
              className="text-lg"
              style={{ color: listening ? "var(--glow-bright)" : "#5a6a72" }}
              title="Voice input"
            >
              {listening ? "\u25A0" : "\ud83c\udfa4"}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? "Listening..." : "Speak, or type a command"}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "#dfeaf0" }}
            />
            <button type="submit" disabled={!input.trim()} className="display-font text-xs glow-text tracking-wider disabled:opacity-30">
              SEND
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
