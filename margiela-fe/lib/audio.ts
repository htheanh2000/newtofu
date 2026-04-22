// Audio utility for playing instrument notes using Web Audio API
// Supports true polyphonic playback (multiple sounds simultaneously)

export type Instrument = "piano" | "violin" | "flute" | "trumpet";
export type NotePitch = "F" | "F#" | "G" | "G#" | "A" | "A#" | "B";

// Map note pitches to file names
const noteToFile: Record<NotePitch, string> = {
  F: "F4",
  "F#": "Fs4",
  G: "G4",
  "G#": "Gs4",
  A: "A4",
  "A#": "As4",
  B: "B4",
};

// Get the sound file path for a given instrument and note
export function getSoundPath(instrument: Instrument, note: NotePitch): string {
  const noteFile = noteToFile[note];

  switch (instrument) {
    case "piano":
      return `/sounds/piano/${noteFile}.mp3`;
    case "flute":
      return `/sounds/flute/flute_${noteFile}_1_mezzo-forte_normal.mp3`;
    case "trumpet":
      const trumpetVariations: Record<string, string> = {
        F4: "trumpet_F4_1_fortissimo_normal.mp3",
        Fs4: "trumpet_Fs4_1_pianissimo_normal.mp3",
        G4: "trumpet_G4_1_forte_normal.mp3",
        Gs4: "trumpet_Gs4_05_fortissimo_normal.mp3",
        A4: "trumpet_A4_1_fortissimo_normal.mp3",
        As4: "trumpet_As4_1_fortissimo_normal.mp3",
        B4: "trumpet_B4_05_forte_normal.mp3",
      };
      return `/sounds/trumpet/${trumpetVariations[noteFile]}`;
    case "violin":
      const violinVariations: Record<string, string> = {
        F4: "violin_F4_1_fortissimo_arco-normal.mp3",
        Fs4: "violin_Fs4_1_fortissimo_arco-normal.mp3",
        G4: "violin_G4_1_fortissimo_arco-normal.mp3",
        Gs4: "violin_Gs4_1_forte_arco-normal.mp3",
        A4: "violin_A4_1_fortissimo_arco-normal.mp3",
        As4: "violin_As4_1_fortissimo_arco-normal.mp3",
        B4: "violin_B4_1_fortissimo_arco-normal.mp3",
      };
      return `/sounds/violin/${violinVariations[noteFile]}`;
    default:
      return `/sounds/piano/${noteFile}.mp3`;
  }
}

// Web Audio API context and state
let audioContext: AudioContext | null = null;
const audioBufferCache: Map<string, AudioBuffer> = new Map();
const activeSourceNodes: Set<AudioBufferSourceNode> = new Set();
let masterGainNode: GainNode | null = null;

// Initialize or get AudioContext
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    masterGainNode = audioContext.createGain();
    masterGainNode.gain.value = 0.8;
    masterGainNode.connect(audioContext.destination);
  }
  
  // Resume context if suspended (required for user interaction on some browsers)
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  
  return audioContext;
}

/** Call when app becomes visible again (e.g. user returns from another app) to resume playback */
export function resumeAudioContext(): void {
  if (typeof window === "undefined") return;
  if (audioContext?.state === "suspended") {
    audioContext.resume();
  }
}

// Load an audio buffer from a URL
async function loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
  try {
    const ctx = getAudioContext();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return audioBuffer;
  } catch (error) {
    console.error("Failed to load audio buffer:", url, error);
    return null;
  }
}

// Play a note for a given instrument (true polyphonic - multiple sounds at once)
export async function playNote(instrument: Instrument, note: NotePitch): Promise<void> {
  if (typeof window === "undefined") return;

  const path = getSoundPath(instrument, note);
  const ctx = getAudioContext();
  
  // Get or load the audio buffer
  let buffer = audioBufferCache.get(path);
  if (!buffer) {
    buffer = await loadAudioBuffer(path) || undefined;
    if (buffer) {
      audioBufferCache.set(path, buffer);
    } else {
      return; // Failed to load
    }
  }
  
  // Create a new source node for this playback (allows true polyphony)
  const sourceNode = ctx.createBufferSource();
  sourceNode.buffer = buffer;
  
  // Connect to master gain
  if (masterGainNode) {
    sourceNode.connect(masterGainNode);
  } else {
    sourceNode.connect(ctx.destination);
  }
  
  // Track this source node
  activeSourceNodes.add(sourceNode);
  
  // Remove from tracking when finished
  sourceNode.onended = () => {
    activeSourceNodes.delete(sourceNode);
  };
  
  // Play immediately
  sourceNode.start(0);
}

// Preload all sounds for an instrument
export async function preloadInstrument(instrument: Instrument): Promise<void> {
  if (typeof window === "undefined") return;

  const notes: NotePitch[] = ["F", "F#", "G", "G#", "A", "A#", "B"];
  
  // Initialize audio context
  getAudioContext();
  
  // Load all notes in parallel
  await Promise.all(
    notes.map(async (note) => {
      const path = getSoundPath(instrument, note);
      if (!audioBufferCache.has(path)) {
        const buffer = await loadAudioBuffer(path);
        if (buffer) {
          audioBufferCache.set(path, buffer);
        }
      }
    })
  );
}

// Stop all currently playing audio
export function stopAllAudio(): void {
  activeSourceNodes.forEach((sourceNode) => {
    try {
      sourceNode.stop();
    } catch {
      // Ignore errors if already stopped
    }
  });
  activeSourceNodes.clear();
}

// Clear audio cache
export function clearAudioCache(): void {
  audioBufferCache.clear();
}
