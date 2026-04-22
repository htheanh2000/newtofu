// Simple client-side state management using localStorage
// For a music composition app flow

// Note duration types: w=4beats, h=2beats, q=1beat, 8=0.5beat, 16=0.25beat
export type NoteDuration = "w" | "h" | "q" | "8" | "16";

export interface Note {
  id: string;
  pitch: string | string[]; // Single note or chord (array of pitches)
  duration: NoteDuration; // VexFlow duration type
}

export interface Composition {
  id: string;
  instrument: "piano" | "violin" | "flute" | "trumpet";
  notes: Note[];
  duration: number; // total duration in seconds (max 30)
  createdAt: string;
  /** When the user started this compose session (Date.now()), for restoring after background */
  sessionStartTime?: number;
}

export interface UserInfo {
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  country: string;
  state: string;
  city: string;
  postcode: string;
  phone: string;
  email: string;
}

export interface AppState {
  composition: Composition | null;
  userInfo: UserInfo | null;
  qrCode: string | null;
}

const STORAGE_KEY = "margiela_state";

export function getState(): AppState {
  if (typeof window === "undefined") {
    return { composition: null, userInfo: null, qrCode: null };
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to parse state:", e);
  }
  
  return { composition: null, userInfo: null, qrCode: null };
}

export function setState(state: Partial<AppState>): void {
  if (typeof window === "undefined") return;
  
  const current = getState();
  const newState = { ...current, ...state };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

// Helper to generate unique IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
