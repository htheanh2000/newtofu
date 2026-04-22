  "use client";

  import { useEffect, useRef, useState } from "react";
  import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Metrics, MetricsDefaults } from "vexflow";

  // Note duration types: w=4beats, h=2beats, q=1beat, 8=0.5beat, 16=0.25beat
  export type NoteDuration = "w" | "h" | "q" | "8" | "16";

  export interface Note {
    id: string;
    pitch: string | string[]; // Single note or chord (array of pitches)
    duration: NoteDuration; // Note type determines duration
  }

  interface MusicSheetProps {
    notes: Note[];
    instrument: string;
    forcePrintWidth?: boolean;
    /** Translated season line for PDF (e.g. "Co-Ed Spring Summer 2026" / "2026 春夏系列") */
    seasonText?: string;
    /** Translated instrument label for sheet header (e.g. "Piano" / "鋼琴"). If not set, falls back to capitalized instrument. */
    instrumentLabel?: string;
    /** Locale for font: en = Courier Recast 12px, zh = Songti TC 12px (per Figma) */
    locale?: string;
  }

  // Configuration
  export const BEATS_PER_BAR = 4;
  export const TOTAL_BARS = 16; // Fixed 16 bars for 30 seconds at 128 BPM

  // Duration to beats mapping
  export const DURATION_TO_BEATS: Record<NoteDuration, number> = {
    "w": 4,    // whole = 4 beats
    "h": 2,    // half = 2 beats
    "q": 1,    // quarter = 1 beat
    "8": 0.5,  // eighth = 0.5 beats
    "16": 0.25 // sixteenth = 0.25 beats
  };

  // Beats to duration mapping (ordered from largest to smallest). No semiquaver (16) in output.
  const BEATS_TO_DURATION: { beats: number; duration: NoteDuration }[] = [
    { beats: 4, duration: "w" },
    { beats: 2, duration: "h" },
    { beats: 1, duration: "q" },
    { beats: 0.5, duration: "8" },
  ];

  // Get the largest duration that fits in remaining beats
  function getLargestFittingDuration(remainingBeats: number): NoteDuration | null {
    for (const { beats, duration } of BEATS_TO_DURATION) {
      if (beats <= remainingBeats) {
        return duration;
      }
    }
    return null;
  }

  // Count sharps in a pitch or chord
  function countSharps(pitch: string | string[]): number {
    const arr = Array.isArray(pitch) ? pitch : [pitch];
    return arr.filter((p) => p.includes("#")).length;
  }

  // Simplify for display: >1# → max 4 notes, crotchet or longer; ≤1# → max 8 quaver or less. No 16th output.
  function simplifyNotesForDisplay(notes: Note[]): Note[] {
    return notes.map((note) => {
      const pitches = Array.isArray(note.pitch) ? note.pitch : [note.pitch];
      const sharpCount = countSharps(note.pitch);
      const maxNotes = sharpCount > 1 ? 4 : 8;
      let outPitch: string | string[] =
        pitches.length <= maxNotes
          ? note.pitch
          : pitches.length === 0
            ? note.pitch
            : (() => {
                const n = pitches.length;
                const picked: string[] = [];
                for (let i = 0; i < maxNotes; i++) {
                  const idx =
                    maxNotes > 1 ? Math.round((i * (n - 1)) / (maxNotes - 1)) : 0;
                  picked.push(pitches[Math.min(idx, n - 1)]);
                }
                return picked;
              })();
      let duration = note.duration;
      if (sharpCount > 1 && (duration === "8" || duration === "16")) {
        duration = "q";
      }
      if (note.duration === "16") {
        duration = "8";
      }
      return { ...note, pitch: outPitch, duration };
    });
  }

  // Convert pitch to VexFlow format
  function pitchToVexFlow(pitch: string): string {
    const pitchMap: Record<string, string> = {
      F: "f/4",
      "F#": "f#/4",
      G: "g/4",
      "G#": "g#/4",
      A: "a/4",
      "A#": "a#/4",
      B: "b/4",
    };
    return pitchMap[pitch] || "c/4";
  }

  // Processed note for rendering (can be note or rest)
  interface BarItem {
    type: "note" | "rest";
    pitch?: string | string[]; // Single pitch or chord (array of pitches)
    duration: NoteDuration;
  }

  // Group notes into bars, ensuring each bar is exactly 4 beats
  // - Trim notes that overflow the bar
  // - Fill remaining beats with rests
  // - No semiquaver in output: 16 → 8
  function groupNotesIntoBars(notes: Note[]): BarItem[][] {
    const simplified = simplifyNotesForDisplay(notes);
    const bars: BarItem[][] = [];
    let currentBar: BarItem[] = [];
    let currentBeats = 0;
    const durationOut = (d: NoteDuration) => (d === "16" ? "8" : d);

    for (const note of simplified) {
      const outDur = durationOut(note.duration) as NoteDuration;
      const noteBeats = DURATION_TO_BEATS[outDur];
      const remainingInBar = BEATS_PER_BAR - currentBeats;
      
      if (noteBeats <= remainingInBar) {
        // Note fits in current bar
        currentBar.push({
          type: "note",
          pitch: note.pitch,
          duration: outDur,
        });
        currentBeats += noteBeats;
      } else {
        // Note is too long - trim to fit remaining space
        if (remainingInBar > 0) {
          const trimmedDuration = getLargestFittingDuration(remainingInBar);
          if (trimmedDuration) {
            currentBar.push({
              type: "note",
              pitch: note.pitch,
              duration: trimmedDuration,
            });
            currentBeats += DURATION_TO_BEATS[trimmedDuration];
          }
        }
        
        // Fill remaining beats with rests if needed
        while (currentBeats < BEATS_PER_BAR) {
          const restDuration = getLargestFittingDuration(BEATS_PER_BAR - currentBeats);
          if (!restDuration) break;
          currentBar.push({ type: "rest", duration: restDuration });
          currentBeats += DURATION_TO_BEATS[restDuration];
        }
        
        // Start new bar
        bars.push(currentBar);
        currentBar = [];
        currentBeats = 0;
      }
      
      // If bar is exactly full, start new bar
      if (currentBeats >= BEATS_PER_BAR) {
        bars.push(currentBar);
        currentBar = [];
        currentBeats = 0;
      }
    }
    
    // Fill last bar with rests to complete 4 beats
    if (currentBar.length > 0) {
      while (currentBeats < BEATS_PER_BAR) {
        const restDuration = getLargestFittingDuration(BEATS_PER_BAR - currentBeats);
        if (!restDuration) break;
        currentBar.push({ type: "rest", duration: restDuration });
        currentBeats += DURATION_TO_BEATS[restDuration];
      }
      bars.push(currentBar);
    }
    
    return bars;
  }

  const DEFAULT_SEASON = "Co-Ed Spring Summer 2026";

  export default function MusicSheet({
    notes,
    instrument,
    forcePrintWidth = false,
    seasonText = DEFAULT_SEASON,
    instrumentLabel,
    locale,
  }: MusicSheetProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    // Resize observer to track container width changes
    useEffect(() => {
      if (!containerRef.current) return;

      const updateWidth = () => {
        if (containerRef.current) {
          setContainerWidth(containerRef.current.clientWidth);
        }
      };

      updateWidth();

      const resizeObserver = new ResizeObserver(updateWidth);
      resizeObserver.observe(containerRef.current);
      window.addEventListener("resize", updateWidth);

      return () => {
        resizeObserver.disconnect();
        window.removeEventListener("resize", updateWidth);
      };
    }, []);

    // Main render effect
    useEffect(() => {
      if (!containerRef.current) return;

      containerRef.current.innerHTML = "";

      const currentWidth = containerWidth || containerRef.current.clientWidth || 600;
      const width = forcePrintWidth ? 800 : currentWidth;
      const staveWidth = width - 20;
      
      // Group notes into bars based on duration
      const notesByBar = groupNotesIntoBars(notes);
      // Always render exactly TOTAL_BARS (16 bars)
      const totalBars = TOTAL_BARS;
      
      const barsPerLine = 2;
      const barWidth = staveWidth / barsPerLine;
      const totalLines = Math.ceil(totalBars / barsPerLine);

      const renderer = new Renderer(
        containerRef.current,
        Renderer.Backends.SVG
      );

      const titleHeight = 62; // Smaller gap from logo to instrument/season line
      const staveTopOffset = 8; // Extra gap before first staff (moves all bars lower)
      const lineHeight = 120; // Vertical distance between staves (tab lines)

      // Scale music-font glyphs (noteheads, flags, accidentals, rests) to 0.8×
      // Stave lines are drawn with path/line commands, so they stay the same size.
      Metrics.clear();
    

      const totalHeight = titleHeight + staveTopOffset + totalLines * lineHeight;

      renderer.resize(width, totalHeight);
      const context = renderer.getContext();

      // Header text: Figma EN = Courier Recast 12px, ZH = Songti TC 12px; ZH season "2026" in Courier Recast Thin
      const headerSize = 14;
      const leftLabel = instrumentLabel ?? instrument.charAt(0).toUpperCase() + instrument.slice(1);
      const seasonX = locale === "zh" ? width - 140 : width - 280;
      context.fillStyle = "#221F20";

      context.setFont(locale === "zh" ? "Songti TC" : "Courier Recast", headerSize, "normal");
      context.fillText(leftLabel, 20, titleHeight);

      if (locale === "zh" && seasonText.startsWith("2026")) {
        const part1 = "2026 ";
        const part2 = seasonText.slice(4); // " 春夏系列"
        context.setFont("Courier Recast", headerSize, "300");
        context.fillText(part1, seasonX, titleHeight);
        const w1 = context.measureText(part1).width;
        context.setFont("Songti TC", headerSize, "normal");
        context.fillText(part2, seasonX + w1, titleHeight);
      } else {
        context.setFont(locale === "zh" ? "Songti TC" : "Courier Recast", headerSize, "normal");
        context.fillText(seasonText, seasonX, titleHeight);
      }

      // Draw staves line by line
      for (let line = 0; line < totalLines; line++) {
        const yPos = titleHeight + staveTopOffset + line * lineHeight;

        // Tab numbering from tab 2: 3, 5, 7, 9, ... (only for line >= 1)
        if (line >= 1) {
          const tabNumber = 2 * line + 1; // tab 2→3, tab 3→5, tab 4→7, tab 5→9
          context.fillStyle = "#221F20";
          context.setFont("Courier Recast", 10, "normal");
          const labelY = yPos + 20; // ~center of 5-line staff (5px spacing)
          context.fillText(String(tabNumber), 8, labelY);
        }

        for (let b = 0; b < barsPerLine; b++) {
          const barIndex = line * barsPerLine + b;
          if (barIndex >= totalBars) break;

          // First tab (line 0) only: indent 16px — shift right 16px and 16px narrower
          const indentPx = 16;
          const isFirstTabFirstBar = line === 0 && b === 0;
          const isFirstBar = b === 0;
          const thisBarWidth = isFirstTabFirstBar ? barWidth - indentPx : barWidth;
          const xPos =
            line === 0
              ? (b === 0 ? 10 + indentPx : 10 + indentPx + (barWidth - indentPx))
              : 10 + b * barWidth;
          const isLastBar = barIndex === totalBars - 1;

          // Create stave (5px between staff lines; 85px between staves via lineHeight)
          const stave = new Stave(xPos, yPos, thisBarWidth, {
            spacingBetweenLinesPx: 8,
          });

          if (isFirstBar && line === 0) {
            stave.addClef("treble").addTimeSignature("4/4");
          } else if (isFirstBar) {
            stave.addClef("treble");
          }

          if (isLastBar) {
            stave.setEndBarType(3); // Double bar
          }

          stave.setContext(context).draw();

          // Get items for this bar (notes and rests)
          const barItems = notesByBar[barIndex] || [];
          const vexNotes: StaveNote[] = [];

          if (barItems.length > 0) {
            for (const item of barItems) {
              try {
                if (item.type === "rest") {
                  // Create rest
                  const rest = new StaveNote({
                    keys: ["b/4"],
                    duration: item.duration + "r", // Append 'r' for rest
                    // render_options: {
                    //   glyph_font_scale: 30 // Example scale value
                    // }
                  
                  });
                  vexNotes.push(rest);
                } else {
                  // Create note or chord
                  const pitches = Array.isArray(item.pitch) ? item.pitch : [item.pitch!];
                  const keys = pitches.map(p => pitchToVexFlow(p));
                  
                  const staveNote = new StaveNote({
                    keys: keys,
                    duration: item.duration,
                  });

                  // Add accidentals for sharp notes
                  pitches.forEach((pitch, index) => {
                    if (pitch.includes("#")) {
                      staveNote.addModifier(new Accidental("#"), index);
                    }
                  });

                  vexNotes.push(staveNote);
                }
              } catch (e) {
                console.error("Error creating note/rest:", e);
              }
            }
          } else {
            // Empty bar - fill with whole rest
            try {
              const wholeRest = new StaveNote({
                keys: ["b/4"],
                duration: "wr", // whole rest
              });
              vexNotes.push(wholeRest);
            } catch (e) {
              console.error("Error creating whole rest:", e);
            }
          }

          // Draw voice if we have notes/rests
          if (vexNotes.length > 0) {
            try {
              const voice = new Voice({
                numBeats: BEATS_PER_BAR,
                beatValue: 4,
              }).setStrict(true); // Strict mode - each bar must be exactly 4 beats
              voice.addTickables(vexNotes);

              const formatWidth = line === 0 ? thisBarWidth - 80 : thisBarWidth - 50;
              new Formatter()
                .joinVoices([voice])
                .format([voice], formatWidth);

              voice.draw(context, stave);
            } catch (e) {
              console.error("Error drawing voice:", e);
            }
          }
        }
      }

    }, [notes, instrument, containerWidth, forcePrintWidth, seasonText, instrumentLabel, locale]);

    return (
      <div className="w-full bg-white">
        {/* Logo + PARIS header (design: centered, red line under) */}
        <header className="flex flex-col items-center pt-4 pb-1.5">
          <img
            src="/images/maison-margiela.svg"
            alt="Maison Margiela"
            className="w-auto h-[56px]"
          />
          
        </header>
        <div ref={containerRef} className="w-full" />
      </div>
    );
  }
