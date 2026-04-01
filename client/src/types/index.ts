// ─── Domain Types ──────────────────────────────────────────────────────────────

export type GhostColor = 'blinky' | 'pinky' | 'inky' | 'clyde';

export const GHOST_HEX: Record<GhostColor, string> = {
  blinky: '#FF0000',
  pinky:  '#FFB8FF',
  inky:   '#00FFFF',
  clyde:  '#FFB852',
};

export const GHOST_COLORS: GhostColor[] = ['blinky', 'pinky', 'inky', 'clyde'];

export type ProximityStatus = 'HOT' | 'WARM' | 'COLD' | 'LOST';

export interface Coordinates {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number | null;
  timestamp: number;
}

export interface Member {
  id: string;
  name: string;
  color: GhostColor;
  isHost: boolean;
  location: Coordinates | null;
}

export type PartyPhase = 'lobby' | 'active';

export interface PartyState {
  code: string;
  phase: PartyPhase;
  members: Member[];
}

// ─── Socket.io Event Payloads ──────────────────────────────────────────────────

export interface ClientToServerEvents {
  'join-party': (payload: { code: string; name: string }) => void;
  'location-update': (payload: Omit<Coordinates, 'timestamp'>) => void;
  'leave-party': () => void;
  'start-party': () => void;
}

export interface ServerToClientEvents {
  'party-joined': (payload: { party: PartyState; you: Member }) => void;
  'member-joined': (member: Member) => void;
  'member-left': (payload: { id: string; name: string }) => void;
  'location-broadcast': (payload: { id: string; location: Coordinates }) => void;
  'party-started': () => void;
  'party-ended': (reason: string) => void;
  'error': (payload: { message: string }) => void;
}

// ─── Radar / UI Types ──────────────────────────────────────────────────────────

export interface FriendBlip {
  member: Member;
  bearing: number;
  distance: number;
  pellets: number;
  status: ProximityStatus;
  isStale: boolean;
}

// ─── App Navigation State ──────────────────────────────────────────────────────

export type Screen = 'home' | 'lobby' | 'radar';
