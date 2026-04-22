"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "@/i18n/navigation";
import { getState, setState, type Composition, type NoteDuration } from "@/lib/store";
import { playNote, stopAllAudio, type Instrument, type NotePitch } from "@/lib/audio";
import { useLocale, useTranslations } from "next-intl";

// Match compose: 16 bars in 30s → 128 BPM
const BPM = 128;
const BEAT_DURATION_MS = (60 / BPM) * 1000;

const DURATION_TO_BEATS: Record<NoteDuration, number> = {
  w: 4,
  h: 2,
  q: 1,
  "8": 0.5,
  "16": 0.25,
};

export default function ReviewPage() {
  const router = useRouter();
  const [composition, setComposition] = useState<Composition | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const playbackStartRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const playbackTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const locale = useLocale();
  const t = useTranslations("review");

  useEffect(() => {
    const state = getState();
    if (state.composition) {
      setComposition(state.composition);
      let duration = 0;
      state.composition.notes.forEach((note) => {
        const noteBeats = DURATION_TO_BEATS[note.duration] || 1;
        duration += noteBeats * BEAT_DURATION_MS;
      });
      duration += BEAT_DURATION_MS;
      setTotalDuration(duration);
    } else {
      router.push("/");
    }
    return () => {
      stopAllAudio();
      playbackTimeoutsRef.current.forEach(clearTimeout);
      playbackTimeoutsRef.current = [];
    };
  }, [router]);

  useEffect(() => {
    const updateProgress = () => {
      if (playbackStartRef.current !== null && isPlaying) {
        const elapsed = performance.now() - playbackStartRef.current;
        const progress = Math.min(elapsed / totalDuration, 1);
        setPlaybackProgress(progress);
        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(updateProgress);
        }
      }
    };
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, totalDuration]);

  const handlePlayback = useCallback(() => {
    if (!composition || isPlaying) return;
    playbackTimeoutsRef.current.forEach(clearTimeout);
    playbackTimeoutsRef.current = [];
    setIsPlaying(true);
    setPlaybackProgress(0);
    playbackStartRef.current = performance.now();

    let currentDelay = 0;
    composition.notes.forEach((note) => {
      const timeout = setTimeout(() => {
        const pitches = Array.isArray(note.pitch) ? note.pitch : [note.pitch];
        pitches.forEach((pitch) => {
          playNote(composition.instrument as Instrument, pitch as NotePitch);
        });
      }, currentDelay);
      playbackTimeoutsRef.current.push(timeout);
      const noteBeats = DURATION_TO_BEATS[note.duration] || 1;
      currentDelay += noteBeats * BEAT_DURATION_MS;
    });

    const playDuration = currentDelay + BEAT_DURATION_MS;
    const endTimeout = setTimeout(() => {
      setIsPlaying(false);
      setPlaybackProgress(1);
      playbackStartRef.current = null;
    }, playDuration);
    playbackTimeoutsRef.current.push(endTimeout);
  }, [composition, isPlaying]);

  const handleComplete = () => {
    stopAllAudio();
    playbackTimeoutsRef.current.forEach(clearTimeout);
    playbackTimeoutsRef.current = [];
    router.push("/identification");
  };

  const handleGoBack = () => {
    stopAllAudio();
    playbackTimeoutsRef.current.forEach(clearTimeout);
    playbackTimeoutsRef.current = [];
    setState({ composition: null });
    router.push("/compose");
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-white">
      <div className="flex-1 min-h-0 overflow-auto flex flex-col items-center px-5 pt-[26px] pb-[100px]">
        <div className="flex flex-col gap-[120px] w-full max-w-[300px]">
          <motion.div
            className="flex flex-col gap-[32px] items-center text-center w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1
              className={`font-title text-black uppercase w-full ${
                locale === "zh" ? "text-[16px] font-bold tracking-[1.6px]" : "text-[15px] font-semibold tracking-[1.5px]"
              }`}
            >
              {t("title")}
            </h1>
            <p
              className={`font-body text-black w-full whitespace-pre-wrap ${
                locale === "zh"
                  ? "text-[14px] leading-[20px] tracking-[1.4px]"
                  : "text-[14px] leading-[1.15]"
              }`}
            >
              {t("description")}
            </p>
          </motion.div>

          <div className="flex flex-col items-center w-full">
            <div className="flex flex-col items-center gap-[48px]">
              <button
                onClick={handlePlayback}
                disabled={isPlaying}
                className={`w-[240px] h-[36px] bg-black text-white font-title uppercase tracking-[1.6px] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center ${
                  locale === "zh" ? "text-[16px] font-bold" : "text-[15px] font-semibold"
                }`}
              >
                {isPlaying ? t("playing") : t("playBack")}
              </button>
              <button
                onClick={handleComplete}
                className={`w-[240px] h-[36px] bg-black text-white font-title uppercase tracking-[1.6px] hover:opacity-90 transition-opacity flex items-center justify-center ${
                  locale === "zh" ? "text-[16px] font-bold" : "text-[15px] font-semibold"
                }`}
              >
                {t("continue")}
              </button>
            </div>
            <div className="flex justify-center mt-[189.5px] w-full">
              <button
                onClick={handleGoBack}
                className={`w-[240px] h-[36px] bg-black text-white font-title uppercase tracking-[1.6px] hover:opacity-90 transition-opacity flex items-center justify-center ${
                  locale === "zh" ? "text-[16px] font-bold" : "text-[15px] font-semibold"
                }`}
              >
                {t("goBack")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
