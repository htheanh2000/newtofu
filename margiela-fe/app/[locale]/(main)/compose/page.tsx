"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "@/i18n/navigation";
import { getState, setState, generateId, type Note, type NoteDuration } from "@/lib/store";
import {
  playNote,
  preloadInstrument,
  stopAllAudio,
  resumeAudioContext,
  type Instrument,
  type NotePitch,
} from "@/lib/audio";
import { useLocale, useTranslations } from "next-intl";

const WHITE_KEYS: NotePitch[] = ["F", "G", "A", "B"];
const BLACK_KEYS: { note: NotePitch; position: number }[] = [
  { note: "F#", position: 0 },
  { note: "G#", position: 1 },
  { note: "A#", position: 2 },
];

// 16 bars × 4 beats = 64 beats in 30s → BPM = 128
const BPM = 128;
const BEAT_DURATION = 60 / BPM;
const SEMIBREVE_DURATION = BEAT_DURATION * 4;
const MINIM_DURATION = BEAT_DURATION * 2;
const CROTCHET_DURATION = BEAT_DURATION * 1;
const QUAVER_DURATION = BEAT_DURATION * 0.5;
const THRESHOLD = 0.8;
const MAX_DURATION = 30;
const WHITE_KEY_HEIGHT = 96;
const CHORD_THRESHOLD = 0.1;

// No semiquaver (16th): shortest allowed is quaver (8th)
function calculateNoteDuration(timeGap: number): NoteDuration {
  if (timeGap >= SEMIBREVE_DURATION * THRESHOLD) return "w";
  if (timeGap >= MINIM_DURATION * THRESHOLD) return "h";
  if (timeGap >= CROTCHET_DURATION * THRESHOLD) return "q";
  if (timeGap >= QUAVER_DURATION * THRESHOLD) return "8";
  return "8";
}

interface LastNoteInfo {
  pitch: NotePitch;
  duration: NoteDuration;
}

export default function ComposePage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("compose");
  const [isPlaying, setIsPlaying] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [notes, setNotes] = useState<Note[]>([]);
  const [instrument, setInstrument] = useState<Instrument>("piano");
  const [lastNoteInfo, setLastNoteInfo] = useState<LastNoteInfo | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(true);

  const animationTimeoutsRef = useRef<Map<NotePitch, NodeJS.Timeout>>(new Map());
  const keyRefsMap = useRef<Map<NotePitch, HTMLDivElement | null>>(new Map());
  const startTimeRef = useRef<number | null>(null);
  const lastNoteTimeRef = useRef<number | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);
  const pianoContainerRef = useRef<HTMLDivElement>(null);
  const restoredFromCacheRef = useRef(false);

  useEffect(() => {
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(hasTouch);
  }, []);

  useEffect(() => {
    const state = getState();
    if (state.composition) {
      setInstrument(state.composition.instrument as Instrument);
      preloadInstrument(state.composition.instrument as Instrument);
      if (state.composition.notes.length > 0) {
        setNotes(state.composition.notes);
        const comp = state.composition;
        const elapsedSecs = comp.sessionStartTime != null
          ? Math.min((Date.now() - comp.sessionStartTime) / 1000, MAX_DURATION)
          : Math.min(comp.duration ?? 0, MAX_DURATION);
        const secs = Math.floor(elapsedSecs);
        setDisplayTime(secs);
        startTimeRef.current = performance.now() - elapsedSecs * 1000;
        sessionStartTimeRef.current = comp.sessionStartTime ?? null;
        setIsPlaying(elapsedSecs < MAX_DURATION);
        restoredFromCacheRef.current = true;
      }
    }
  }, []);

  // Persist composition to cache on every note so it survives tab background/kill
  useEffect(() => {
    if (sessionStartTimeRef.current == null) return;
    const state = getState();
    if (!state.composition) return;
    setState({
      composition: {
        ...state.composition,
        notes,
        sessionStartTime: sessionStartTimeRef.current,
      },
    });
  }, [notes]);

  // Re-sync timer and resume audio when user returns to the tab
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      resumeAudioContext();
      const sessionStart = sessionStartTimeRef.current ?? getState().composition?.sessionStartTime;
      if (sessionStart != null && startTimeRef.current != null) {
        const elapsed = Math.min((Date.now() - sessionStart) / 1000, MAX_DURATION);
        setDisplayTime(Math.floor(elapsed));
        startTimeRef.current = performance.now() - elapsed * 1000;
        if (elapsed >= MAX_DURATION) setIsPlaying(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    let animationFrame: number;
    const updateTime = () => {
      if (startTimeRef.current !== null) {
        const elapsed = (performance.now() - startTimeRef.current) / 1000;
        if (elapsed >= MAX_DURATION) {
          setDisplayTime(MAX_DURATION);
          setIsPlaying(false);
          return;
        }
        setDisplayTime(Math.floor(elapsed));
      }
      if (isPlaying) {
        animationFrame = requestAnimationFrame(updateTime);
      }
    };
    if (isPlaying) {
      animationFrame = requestAnimationFrame(updateTime);
    }
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isPlaying]);

  const handlePlayNote = useCallback(
    (pitch: NotePitch) => {
      if (restoredFromCacheRef.current) {
        setState({ composition: null });
        restoredFromCacheRef.current = false;
        setNotes([]);
        startTimeRef.current = performance.now();
        sessionStartTimeRef.current = Date.now();
        lastNoteTimeRef.current = null;
        setDisplayTime(0);
        setIsPlaying(true);
      }
      if (startTimeRef.current === null) {
        startTimeRef.current = performance.now();
        const now = Date.now();
        sessionStartTimeRef.current = now;
        const state = getState();
        const comp = state.composition;
        setState({
          composition: {
            id: comp?.id ?? generateId(),
            instrument: comp?.instrument ?? instrument,
            notes: [],
            duration: MAX_DURATION,
            createdAt: comp?.createdAt ?? new Date().toISOString(),
            sessionStartTime: now,
          },
        });
        setIsPlaying(true);
      }
      const accurateTime = (performance.now() - startTimeRef.current) / 1000;
      if (accurateTime >= MAX_DURATION) return;

      const noteId = generateId();
      playNote(instrument, pitch);

      const existingTimeout = animationTimeoutsRef.current.get(pitch);
      if (existingTimeout) clearTimeout(existingTimeout);

      const keyElement = keyRefsMap.current.get(pitch);
      if (keyElement) {
        const isBlackKey = pitch.includes("#");
        keyElement.style.backgroundColor = isBlackKey ? "#444444" : "#e5e5e5";
      }

      const isChord =
        lastNoteTimeRef.current !== null &&
        accurateTime - lastNoteTimeRef.current < CHORD_THRESHOLD;

      if (isChord) {
        setNotes((prev) => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const lastNote = updated[updated.length - 1];
          const existingPitches = Array.isArray(lastNote.pitch)
            ? lastNote.pitch
            : [lastNote.pitch];
          if (!existingPitches.includes(pitch)) {
            updated[updated.length - 1] = {
              ...lastNote,
              pitch: [...existingPitches, pitch],
            };
          }
          return updated;
        });
      } else {
        if (lastNoteTimeRef.current !== null) {
          const timeGap = accurateTime - lastNoteTimeRef.current;
          const prevDuration = calculateNoteDuration(timeGap);
          setNotes((prev) => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const prevNote = updated[updated.length - 1];
            updated[updated.length - 1] = { ...prevNote, duration: prevDuration };
            return updated;
          });
        }
        lastNoteTimeRef.current = accurateTime;
        setNotes((prev) => [
          ...prev,
          { id: noteId, pitch, duration: "w" as NoteDuration },
        ]);
      }

      const timeout = setTimeout(() => {
        const keyEl = keyRefsMap.current.get(pitch);
        if (keyEl) {
          const isBlackKey = pitch.includes("#");
          keyEl.style.backgroundColor = isBlackKey ? "#000000" : "#ffffff";
        }
        animationTimeoutsRef.current.delete(pitch);
      }, 400);
      animationTimeoutsRef.current.set(pitch, timeout);
    },
    [instrument]
  );

  const handleComplete = () => {
    stopAllAudio();
    const state = getState();
    const finalDuration =
      startTimeRef.current
        ? Math.min((performance.now() - startTimeRef.current) / 1000, MAX_DURATION)
        : 0;
    setState({
      composition: {
        id: state.composition?.id || generateId(),
        instrument: state.composition?.instrument || instrument,
        notes,
        duration: finalDuration,
        createdAt: state.composition?.createdAt || new Date().toISOString(),
        // omit sessionStartTime so review doesn't treat it as in-progress
      },
    });
    router.push("/review");
  };

  const setKeyRef = useCallback((pitch: NotePitch, el: HTMLDivElement | null) => {
    keyRefsMap.current.set(pitch, el);
  }, []);

  const getNoteFromTouch = useCallback((touch: React.Touch): NotePitch | null => {
    const container = pianoContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return null;
    const BLACK_KEY_WIDTH = 195;
    const BLACK_KEY_HEIGHT = 48;
    for (const { note, position } of BLACK_KEYS) {
      const keyTop = WHITE_KEY_HEIGHT * (position + 1) - 24;
      const keyBottom = keyTop + BLACK_KEY_HEIGHT;
      const keyLeft = rect.width - BLACK_KEY_WIDTH;
      if (y >= keyTop && y <= keyBottom && x >= keyLeft) return note;
    }
    const whiteKeyIndex = Math.floor(y / WHITE_KEY_HEIGHT);
    if (whiteKeyIndex >= 0 && whiteKeyIndex < WHITE_KEYS.length) {
      return WHITE_KEYS[whiteKeyIndex];
    }
    return null;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const touchedNotes: NotePitch[] = [];
      for (let i = 0; i < e.changedTouches.length; i++) {
        const note = getNoteFromTouch(e.changedTouches[i]);
        if (note && !touchedNotes.includes(note)) touchedNotes.push(note);
      }
      touchedNotes.forEach((note) => handlePlayNote(note));
    },
    [getNoteFromTouch, handlePlayNote]
  );

  const handleKeyClick = useCallback(
    (note: NotePitch) => handlePlayNote(note),
    [handlePlayNote]
  );

  const formatTime = (seconds: number) => {
    const totalSecs = Math.floor(seconds);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const hasStarted = isPlaying || displayTime > 0;

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="flex flex-col items-center w-full max-w-[300px] pt-[26px] mx-auto">
        <div className="flex flex-col gap-[32px] w-full">
          <motion.div
            className="flex flex-col gap-[12px] text-center w-full min-h-[52px] justify-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h1
              className={`font-title uppercase text-black w-full ${
                locale === "zh" ? "text-[16px] font-bold tracking-[1.6px]" : "text-[15px] font-semibold tracking-[1.5px]"
              }`}
            >
              {t("title")}
            </h1>
            <div className="flex flex-col items-center gap-3 min-h-[52px] justify-center">
              {!hasStarted ? (
                <p
                  className="font-body text-[14px] leading-[20px] tracking-[1.4px] text-black w-full"
                >
                  {t("intro", { seconds: MAX_DURATION })}
                </p>
              ) : (
                <>
                  <span className="font-title text-[14px] text-black">
                    {formatTime(MAX_DURATION - displayTime)}
                  </span>
                  <div className="w-[240px] h-[2px] bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-black transition-all duration-300 ease-linear"
                      style={{ width: `${(displayTime / MAX_DURATION) * 100}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          </motion.div>

          <motion.div
            className="w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-start gap-[10px]">
              <div className="flex flex-col">
              {WHITE_KEYS.map((note) => (
                <div
                  key={note}
                  className="flex items-center justify-end pr-1"
                  style={{ height: WHITE_KEY_HEIGHT }}
                >
                  <span className="font-title text-[14px] text-black">{note}</span>
                </div>
              ))}
              </div>
              <div
                ref={pianoContainerRef}
                className={`relative flex-1 border border-black rounded-[10px] overflow-hidden ${isTouchDevice ? "touch-none" : ""}`}
                onTouchStart={isTouchDevice ? handleTouchStart : undefined}
              >
                <div className="flex flex-col">
                  {WHITE_KEYS.map((note, idx) => (
                    <div
                      key={note}
                      ref={(el) => setKeyRef(note, el)}
                      className={`relative w-full cursor-pointer select-none transition-colors duration-100 ${
                        idx < WHITE_KEYS.length - 1 ? "border-b border-black" : ""
                      }`}
                      style={{
                        height: WHITE_KEY_HEIGHT,
                        backgroundColor: "#ffffff",
                      }}
                      onClick={
                        !isTouchDevice ? () => handleKeyClick(note) : undefined
                      }
                      data-note={note}
                      data-key-type="white"
                    />
                  ))}
                </div>
                {BLACK_KEYS.map(({ note, position }) => (
                  <div
                    key={note}
                    ref={(el) => setKeyRef(note, el)}
                    className="absolute right-0 w-[195px] h-[48px] cursor-pointer select-none z-10 transition-colors duration-100"
                    style={{
                      top: WHITE_KEY_HEIGHT * (position + 1) - 24,
                      backgroundColor: "#000000",
                    }}
                    onClick={
                      !isTouchDevice
                        ? (e) => {
                            e.stopPropagation();
                            handleKeyClick(note);
                          }
                        : undefined
                    }
                    data-note={note}
                    data-key-type="black"
                  />
                ))}
              </div>
              <div
                className="relative"
                style={{ height: WHITE_KEY_HEIGHT * 4 }}
              >
                {BLACK_KEYS.map(({ note, position }) => (
                  <div
                    key={note}
                    className="absolute flex items-center pl-1"
                    style={{
                      top: WHITE_KEY_HEIGHT * (position + 1) - 24 + 24 - 6,
                      height: 48,
                    }}
                  >
                    <span className="font-title text-[14px] text-black">
                      {note}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {hasStarted && (
            <motion.div
              className="flex justify-center mt-[20px]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <button
                onClick={handleComplete}
                className={`w-[240px] h-[36px] bg-black text-white font-title uppercase hover:opacity-90 transition-opacity flex items-center justify-center ${
                  locale === "zh" ? "text-[16px] font-bold tracking-[1.6px]" : "text-[15px] font-semibold tracking-[1.5px]"
                }`}
              >
                {t("continue")}
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
