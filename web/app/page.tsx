"use client";

import { useState, useRef, useEffect, useCallback, CSSProperties } from "react";
import ReactDOM from "react-dom";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  weather?: WeatherCard;
  links?: BrowserAction[];
};
type ApiHistoryItem = { role: string; content: string };
type UiState = "idle" | "listening" | "thinking" | "found";
type Accent = "cyan" | "amber" | "violet";

type BrowserAction = { type: "open_url"; url: string; label?: string };
type WeatherCard = {
  type: "weather_card";
  location: string;
  icon: string;
  condition: string;
  temperature: number | null;
  feels_like: number | null;
  humidity: number | null;
  wind_speed: number | null;
  wind_direction?: string;
  temperature_unit?: string;
  wind_unit?: string;
};
type ApiAction = BrowserAction | WeatherCard;
type ApiResponse = { answer: string; trace?: unknown[]; actions?: ApiAction[] };

const AI_SERVICE_URL = "https://aura-os-production-50b6.up.railway.app";
const SUGGESTIONS = ["What's the weather in London?", "Open YouTube", "Set the lights amber"];
const DIRECT_SITES: Record<string, { url: string; label: string }> = {
  youtube: { url: "https://www.youtube.com", label: "YouTube" },
  google: { url: "https://www.google.com", label: "Google" },
  gmail: { url: "https://mail.google.com", label: "Gmail" },
  github: { url: "https://github.com", label: "GitHub" },
  reddit: { url: "https://www.reddit.com", label: "Reddit" },
  instagram: { url: "https://www.instagram.com", label: "Instagram" },
  horizon: { url: "https://horizon.ucp.edu.pk", label: "UCP Horizon" },
  gsmarena: { url: "https://www.gsmarena.com", label: "GSMArena" },
};

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

const BATTLE_OFF =
  /\b(deactivate|disengage|stand\s*down|normal\s*mode)\b|\bbattle\s*mode\b.{0,10}\boff\b|\bexit\b.{0,10}\bbattle\s*mode\b/i;
const BATTLE_ON =
  /\b(activate|engage|enable)\b.{0,15}\bbattle\s*mode\b|\bbattle\s*mode\b.{0,10}\bon\b/i;

function withYesSir(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "Yes, sir.";
  return /^yes,?\s+sir\b/i.test(trimmed) ? trimmed : `Yes, sir. ${trimmed}`;
}

function isSafeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function Portal({ children, id }: { children: React.ReactNode; id: string }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById(id);
    if (el) setContainer(el);
  }, [id]);

  if (!container) return null;
  return ReactDOM.createPortal(children, container);
}

/* ---------- Ticking fake-telemetry helper ---------- */
function useTicker(base: number, jitter: number) {
  const [value, setValue] = useState(base);
  useEffect(() => {
    const id = setInterval(() => {
      setValue(base + (Math.random() - 0.5) * jitter);
    }, 1400);
    return () => clearInterval(id);
  }, [base, jitter]);
  return value;
}

/* ---------- Decode/materialize text effect ---------- */
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&";

function DecodeText({ text }: { text: string }) {
  const [display, setDisplay] = useState("");
  useEffect(() => {
    let frame = 0;
    const totalFrames = Math.min(36, Math.max(12, text.length));
    const id = setInterval(() => {
      frame++;
      const revealCount = Math.floor((frame / totalFrames) * text.length);
      const revealed = text.slice(0, revealCount);
      const scrambled = text
        .slice(revealCount)
        .split("")
        .map((c) => (c === " " ? " " : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]))
        .join("");
      setDisplay(revealed + scrambled);
      if (frame >= totalFrames) {
        setDisplay(text);
        clearInterval(id);
      }
    }, 22);
    return () => clearInterval(id);
  }, [text]);
  return <>{display}</>;
}

/* ---------- Ambient background particles ---------- */
function ParticleField() {
  const [particles, setParticles] = useState<{ x: number; y: number; delay: number }[]>([]);
  useEffect(() => {
    setParticles(
      Array.from({ length: 16 }).map(() => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 8,
      }))
    );
  }, []);
  return (
    <div className="particle-field" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className="particle"
          style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.delay}s` }}
        />
      ))}
    </div>
  );
}

/* ---------- The signature element: layered hex reticle ---------- */
function CoreReticle() {
  const coherence = useTicker(98, 1.4);
  return (
    <div className="flex flex-col items-center">
      <div className="reticle" aria-hidden="true">
        <svg viewBox="0 0 160 160">
          {/* rotating major tick ring */}
          <g className="reticle-ticks">
            {Array.from({ length: 24 }).map((_, i) => (
              <line
                key={i}
                x1="80"
                y1="10"
                x2="80"
                y2={i % 6 === 0 ? "2" : "5"}
                stroke="var(--glow)"
                strokeWidth={i % 6 === 0 ? 1.5 : 0.75}
                opacity={i % 6 === 0 ? 0.8 : 0.35}
                transform={`rotate(${i * 15} 80 80)`}
              />
            ))}
          </g>

          {/* static outer ring */}
          <circle cx="80" cy="80" r="70" fill="none" stroke="var(--glow-dim)" strokeWidth="1" />

          {/* secondary slow counter-rotating dashed ring - pure depth/atmosphere */}
          <g className="reticle-orbit2">
            <circle
              cx="80"
              cy="80"
              r="32"
              fill="none"
              stroke="var(--glow-dim)"
              strokeWidth="1"
              strokeDasharray="3 8"
            />
          </g>

          {/* primary state-driven arc */}
          <circle
            className="reticle-arc"
            cx="80"
            cy="80"
            r="50"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="230 314"
          />

          {/* single orbiting particle */}
          <g className="reticle-orbit-dot">
            <circle cx="80" cy="24" r="2.2" fill="var(--glow-bright)" />
          </g>

          {/* hexagonal core - deliberately not a circle */}
          <polygon
            className="reticle-core"
            points="89,80 84.5,87.79 75.5,87.79 71,80 75.5,72.21 84.5,72.21"
          />
        </svg>
      </div>
      <p className="telemetry">
        COHERENCE <b>{coherence.toFixed(1)}%</b>
      </p>
    </div>
  );
}

/* ---------- Ambient corner telemetry (desktop only) ---------- */
function CornerReadouts() {
  const load = useTicker(34, 6);
  return (
    <>
      <div className="corner-readout tl">
        SYS.LOAD <b>{load.toFixed(1)}%</b>
        <br />
        NET.LINK <b>STABLE</b>
      </div>
      <div className="corner-readout br">
        UNIT <b>01</b>
        <br />
        STATUS <b>NOMINAL</b>
      </div>
    </>
  );
}

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
  const [accent, setAccent] = useState<Accent>("violet");
  const [brightness, setBrightness] = useState(1);
  const [motionOn, setMotionOn] = useState(true);
  const [showLights, setShowLights] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [showVoicePicker, setShowVoicePicker] = useState(false);

  const dataState = battleMode ? "battle" : uiState;
  const rootStyle = { "--ui-brightness": brightness } as CSSProperties;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: motionOn ? "smooth" : "auto" });
  }, [messages, uiState, motionOn]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("aura-lights") || "null");
      if (saved?.accent === "cyan" || saved?.accent === "amber" || saved?.accent === "violet")
        setAccent(saved.accent);
      if (typeof saved?.brightness === "number")
        setBrightness(Math.min(1.2, Math.max(0.65, saved.brightness)));
      if (typeof saved?.motionOn === "boolean") setMotionOn(saved.motionOn);
    } catch {
      /* localStorage may be unavailable */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("aura-lights", JSON.stringify({ accent, brightness, motionOn }));
  }, [accent, brightness, motionOn]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    function loadVoices() {
      const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      setAvailableVoices(voices);
      const best =
        voices.find((v) => /google/i.test(v.name) && /female/i.test(v.name)) ||
        voices.find((v) => /google us english/i.test(v.name)) ||
        voices.find((v) => /samantha|zira|victoria|susan/i.test(v.name)) ||
        voices.find((v) => /google/i.test(v.name)) ||
        voices[0];
      if (best && !voiceRef.current) {
        voiceRef.current = best;
        setSelectedVoiceURI(best.voiceURI);
      }
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!voiceOn || typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) utterance.voice = voiceRef.current;
      utterance.rate = battleMode ? 1.1 : 1;
      utterance.pitch = battleMode ? 0.9 : 1.05;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [voiceOn, battleMode]
  );

  function selectVoice(uri: string) {
    setSelectedVoiceURI(uri);
    const selected = availableVoices.find((v) => v.voiceURI === uri);
    if (selected) voiceRef.current = selected;
  }

  function previewVoice(voice: SpeechSynthesisVoice) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Hello. I'm Jarvis. This is how I sound.");
    utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  function addLocalResponse(command: string, response: string) {
    const answer = withYesSir(response);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: command },
      { role: "assistant", content: answer },
    ]);
    speak(answer);
    setInput("");
  }

  function openUrl(url: string) {
    if (!isSafeUrl(url)) return false;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    return Boolean(opened);
  }

  function tryLocalCommand(text: string) {
    if (BATTLE_OFF.test(text)) {
      setBattleMode(false);
      addLocalResponse(text, "Standing down.");
      return true;
    }
    if (BATTLE_ON.test(text)) {
      setBattleMode(true);
      addLocalResponse(text, "Battle mode engaged.");
      return true;
    }

    const lower = text.toLowerCase();
    const directSite = Object.entries(DIRECT_SITES).find(([name]) =>
      new RegExp(`\\b(open|go to|visit|launch)\\s+(?:the\\s+)?${name}\\b`, "i").test(lower)
    );
    if (directSite) {
      const [, site] = directSite;
      const opened = openUrl(site.url);
      if (opened) {
        addLocalResponse(text, `Opening ${site.label} in a new tab.`);
      } else {
        const answer = withYesSir(
          `I prepared ${site.label}, but your browser blocked the new tab. Here's the link:`
        );
        setMessages((prev) => [
          ...prev,
          { role: "user", content: text },
          { role: "assistant", content: answer, links: [{ type: "open_url", url: site.url, label: site.label }] },
        ]);
        speak(answer);
        setInput("");
      }
      return true;
    }

    if (/\b(lights?|brightness)\b/i.test(text)) {
      if (/\b(amber|warm|orange)\b/i.test(text)) setAccent("amber");
      else if (/\b(violet|purple)\b/i.test(text)) setAccent("violet");
      else if (/\b(cyan|blue|cool)\b/i.test(text)) setAccent("cyan");
      if (/\b(brighter|brighten|up)\b/i.test(text))
        setBrightness((value) => Math.min(1.2, +(value + 0.1).toFixed(2)));
      if (/\b(dimmer|dim|down)\b/i.test(text))
        setBrightness((value) => Math.max(0.65, +(value - 0.1).toFixed(2)));
      addLocalResponse(text, "Interface lighting adjusted.");
      return true;
    }
    if (/\banimations?\b.*\b(off|disable|stop)\b|\b(no|without)\s+motion\b/i.test(text)) {
      setMotionOn(false);
      addLocalResponse(text, "Animations disabled.");
      return true;
    }
    if (/\banimations?\b.*\b(on|enable|start)\b|\bmotion\s+on\b/i.test(text)) {
      setMotionOn(true);
      addLocalResponse(text, "Animations enabled.");
      return true;
    }
    return false;
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    if (tryLocalCommand(text)) return;

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

      const raw = await res.text();
      console.log("AI SERVICE RAW RESPONSE:", raw);

      if (!raw.trim()) {
        throw new Error("AI service returned an empty response");
      }

      let data: ApiResponse;

      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`AI service returned invalid JSON: ${raw.slice(0, 300)}`);
      }
      const actions = (data.actions || []).filter((a): a is ApiAction => Boolean(a));
      const weather = actions.find((a): a is WeatherCard => a.type === "weather_card");
      const links = actions.filter((a): a is BrowserAction => a.type === "open_url");
      links.forEach((a) => {
        if (isSafeUrl(a.url)) openUrl(a.url);
      });

      const direct = /\b(open|set|turn|enable|disable|show|get|check)\b/i.test(text);
      const answer = direct ? withYesSir(data.answer) : data.answer;

      setUiState("found");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer, weather, links: links.length ? links : undefined },
      ]);
      setApiHistory((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: data.answer },
      ]);
      if (answer) speak(answer);
      window.setTimeout(() => setUiState("idle"), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setUiState("idle");
    }
  }

  function toggleMic() {
    if (typeof window === "undefined") return;
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => MinimalSpeechRecognition })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => MinimalSpeechRecognition })
        .webkitSpeechRecognition;

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
    recognition.onresult = (e) => sendMessage(e.results[e.results.length - 1][0].transcript);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError("I couldn't hear that. Check microphone permissions and try again.");
    };
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

  const accentColors: Record<Accent, string> = {
    violet: "#c6a0ff",
    cyan: "#62e6ff",
    amber: "#ffc56b",
  };

  function WeatherCardView({ weather }: { weather: WeatherCard }) {
    const value = (n: number | null | undefined, suffix = "") =>
      n == null ? "—" : `${Math.round(n)}${suffix}`;
    return (
      <div className="weather-card mt-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-[0.2em]" style={{ color: "var(--glow)" }}>
              LIVE CONDITIONS
            </p>
            <h2 className="display-font text-base mt-1">{weather.location}</h2>
            <p className="text-xs mt-1" style={{ color: "#9aabb2" }}>
              {weather.condition}
            </p>
          </div>
          <span className="text-4xl" aria-hidden="true">
            {weather.icon}
          </span>
        </div>
        <div className="flex items-end gap-2 mt-4">
          <strong className="display-font text-4xl">{value(weather.temperature)}</strong>
          <span className="text-sm mb-1">{weather.temperature_unit || "°C"}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 text-xs" style={{ color: "#9aabb2" }}>
          <span>
            FEELS
            <br />
            <b>{value(weather.feels_like, weather.temperature_unit || "°C")}</b>
          </span>
          <span>
            HUMIDITY
            <br />
            <b>{value(weather.humidity, "%")}</b>
          </span>
          <span>
            WIND
            <br />
            <b>
              {value(weather.wind_speed, ` ${weather.wind_unit || "km/h"}`)} {weather.wind_direction || ""}
            </b>
          </span>
        </div>
      </div>
    );
  }
}
