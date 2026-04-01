export type GhostColor = 'blinky' | 'pinky' | 'inky' | 'clyde';

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

export interface WebRTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
}

export interface ClientToServerEvents {
  'join-party': (payload: { code: string; name: string }) => void;
  'location-update': (payload: Omit<Coordinates, 'timestamp'>) => void;
  'leave-party': () => void;
  'start-party': () => void;
  'webrtc-signal': (payload: { to: string; signal: WebRTCSignal }) => void;
}

export interface ServerToClientEvents {
  'party-joined': (payload: { party: PartyState; you: Member }) => void;
  'member-joined': (member: Member) => void;
  'member-left': (payload: { id: string; name: string }) => void;
  'location-broadcast': (payload: { id: string; location: Coordinates }) => void;
  'party-started': () => void;
  'party-ended': (reason: string) => void;
  'error': (payload: { message: string }) => void;
  'webrtc-signal': (payload: { from: string; signal: WebRTCSignal }) => void;
}
