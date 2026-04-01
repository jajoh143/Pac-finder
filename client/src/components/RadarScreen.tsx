import { useEffect, useRef, useMemo } from 'react';
import type { Socket } from 'socket.io-client';
import { useGeolocation } from '../hooks/useGeolocation.ts';
import { useWebRTC } from '../hooks/useWebRTC.ts';
import { useLocationCache } from '../hooks/useLocationCache.ts';
import { PacManRadar } from './PacManRadar.tsx';
import type {
  PartyState,
  Member,
  Coordinates,
  FriendBlip,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/index.ts';
import { GHOST_HEX } from '../types/index.ts';
import type { PeerStatus } from '../hooks/useWebRTC.ts';
import {
  haversineDistance,
  bearing,
  distanceToPellets,
  getProximityStatus,
  isStaleLocation,
} from '../utils/geo.ts';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface Props {
  party: PartyState;
  myMember: Member;
  locations: Map<string, Coordinates>;
  socket: AppSocket | null;
  onLeave: () => void;
  emitLocation: (coords: Omit<Coordinates, 'timestamp'>) => void;
  onWebRTCLocation: (fromId: string, coords: Coordinates) => void;
}

const EMIT_INTERVAL_MS = 2000;

const PROXIMITY_COLORS: Record<string, string> = {
  HOT: '#ff4444',
  WARM: '#ff8800',
  COLD: '#4488ff',
  LOST: '#444',
};

export function RadarScreen({
  party,
  myMember,
  locations,
  socket,
  onLeave,
  emitLocation,
  onWebRTCLocation,
}: Props) {
  const { coords, error: geoError, isWatching } = useGeolocation(true);
  const lastEmitRef = useRef<number>(0);
  const { update: cacheUpdate, getCached } = useLocationCache(party.code);

  // IDs of all other members — stable reference via useMemo
  const otherMemberIds = useMemo(
    () => party.members.filter((m) => m.id !== myMember.id).map((m) => m.id),
    [party.members, myMember.id]
  );

  const { peerStatuses, broadcastLocation } = useWebRTC(
    socket,
    myMember.id,
    otherMemberIds,
    onWebRTCLocation
  );

  // Throttle location emits; send via WebRTC DataChannels AND Socket.io
  useEffect(() => {
    if (!coords) return;
    const now = Date.now();
    if (now - lastEmitRef.current < EMIT_INTERVAL_MS) return;
    lastEmitRef.current = now;

    const payload = {
      lat: coords.lat,
      lng: coords.lng,
      accuracy: coords.accuracy,
      heading: coords.heading,
    };

    // Broadcast to connected peers directly (P2P, bypasses server)
    broadcastLocation(payload);

    // Also relay via Socket.io for peers without an open DataChannel
    emitLocation(payload);
  }, [coords, broadcastLocation, emitLocation]);

  // Keep the location cache up-to-date for offline fallback
  useEffect(() => {
    for (const member of party.members) {
      if (member.id === myMember.id) continue;
      const loc = locations.get(member.id);
      if (loc) cacheUpdate(member.id, member.name, member.color, loc);
    }
  }, [locations, party.members, myMember.id, cacheUpdate]);

  // Load cached locations once on mount as initial fallback
  const cachedLocations = useMemo(() => getCached(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute blips for all other members
  const blips = useMemo<FriendBlip[]>(() => {
    if (!coords) return [];

    return party.members
      .filter((m) => m.id !== myMember.id)
      .map((member) => {
        // Live location takes priority; fall back to cached
        const loc = locations.get(member.id) ?? cachedLocations.get(member.id) ?? null;
        if (!loc) {
          return {
            member,
            bearing: 0,
            distance: 9999,
            pellets: 999,
            status: 'LOST' as const,
            isStale: true,
          };
        }
        const dist = haversineDistance(coords, loc);
        const bear = bearing(coords, loc);
        const isFromCache = !locations.has(member.id);
        return {
          member,
          bearing: bear,
          distance: dist,
          pellets: distanceToPellets(dist),
          status: getProximityStatus(dist),
          isStale: isFromCache || isStaleLocation(loc),
        };
      })
      .filter((b) => b.status !== 'LOST' || locations.has(b.member.id) || cachedLocations.has(b.member.id));
  }, [coords, party.members, myMember.id, locations, cachedLocations]);

  const weakGps = coords?.accuracy !== undefined && coords.accuracy > 50;
  const isWide = window.innerWidth > 600;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#000',
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid #111',
          flexShrink: 0,
          gap: '8px',
        }}
      >
        <button
          onClick={onLeave}
          style={{
            background: 'transparent',
            border: '1px solid #333',
            color: '#888',
            padding: '6px 10px',
            fontSize: '8px',
            fontFamily: 'inherit',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
        >
          LEAVE
        </button>

        <div style={{ fontSize: '9px', color: '#FFE000' }}>PARTY {party.code}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* P2P connection count */}
          <P2PIndicator peerStatuses={peerStatuses} total={otherMemberIds.length} />

          {/* GPS indicator */}
          <div
            style={{
              fontSize: '8px',
              color: isWatching && coords ? '#00ff00' : '#ff4444',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isWatching && coords ? '#00ff00' : '#ff4444',
              }}
            />
            GPS
          </div>
        </div>
      </div>

      {/* Warnings */}
      {geoError && (
        <div
          style={{
            background: '#2a0000',
            borderBottom: '1px solid #ff4444',
            padding: '8px 12px',
            fontSize: '8px',
            color: '#ff6666',
            lineHeight: '1.6',
            flexShrink: 0,
          }}
        >
          {geoError}
        </div>
      )}
      {weakGps && !geoError && (
        <div
          style={{
            background: '#1a1100',
            borderBottom: '1px solid #ff8800',
            padding: '6px 12px',
            fontSize: '7px',
            color: '#ff8800',
            flexShrink: 0,
          }}
        >
          GPS SIGNAL WEAK ({Math.round(coords!.accuracy!)}m accuracy)
        </div>
      )}

      {/* Radar + sidebar */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: isWide ? 'row' : 'column',
          overflow: 'hidden',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 0,
          }}
        >
          <PacManRadar blips={blips} myAccuracy={coords?.accuracy} />
        </div>

        {blips.length > 0 && (
          <div
            style={{
              width: isWide ? '190px' : '100%',
              maxHeight: isWide ? '100%' : '160px',
              overflowY: 'auto',
              borderLeft: isWide ? '1px solid #111' : 'none',
              borderTop: isWide ? 'none' : '1px solid #111',
              flexShrink: 0,
              padding: '8px',
              display: 'flex',
              flexDirection: isWide ? 'column' : 'row',
              flexWrap: isWide ? 'nowrap' : 'wrap',
              gap: '6px',
            }}
          >
            {blips.map((blip) => (
              <FriendCard
                key={blip.member.id}
                blip={blip}
                peerStatus={peerStatuses.get(blip.member.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Acquiring GPS overlay */}
      {!coords && !geoError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '10px', color: '#FFE000', textAlign: 'center' }}>
            ACQUIRING GPS...
          </div>
          <div
            style={{
              fontSize: '8px',
              color: '#555',
              textAlign: 'center',
              maxWidth: '240px',
              lineHeight: '1.8',
            }}
          >
            Allow location access when prompted
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function P2PIndicator({
  peerStatuses,
  total,
}: {
  peerStatuses: Map<string, PeerStatus>;
  total: number;
}) {
  if (total === 0) return null;

  const connected = [...peerStatuses.values()].filter((s) => s === 'connected').length;
  const hasAny = peerStatuses.size > 0;

  return (
    <div
      title={`${connected}/${total} peers connected via Bluetooth/P2P`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '7px',
        color: connected > 0 ? '#00FFFF' : hasAny ? '#ff8800' : '#555',
        background: connected > 0 ? '#001a1a' : '#111',
        border: `1px solid ${connected > 0 ? '#00FFFF44' : '#333'}`,
        padding: '3px 6px',
        borderRadius: '3px',
        cursor: 'default',
      }}
    >
      <svg width="8" height="10" viewBox="0 0 8 10" fill="none">
        {/* Bluetooth-ish icon */}
        <path d="M4 1 L4 9 M4 1 L7 3.5 L4 6 L7 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M4 6 L1 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      P2P {connected}/{total}
    </div>
  );
}

function FriendCard({
  blip,
  peerStatus,
}: {
  blip: FriendBlip;
  peerStatus: PeerStatus | undefined;
}) {
  const color = GHOST_HEX[blip.member.color];
  const proximityColor = PROXIMITY_COLORS[blip.status];
  const isP2P = peerStatus === 'connected';

  return (
    <div
      style={{
        background: '#0a0a0a',
        border: `1px solid ${blip.isStale ? '#222' : color + '66'}`,
        borderRadius: '6px',
        padding: '8px',
        opacity: blip.isStale ? 0.6 : 1,
        minWidth: '120px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '4px',
        }}
      >
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50% 50% 40% 40%',
            background: color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: '8px',
            color,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {blip.member.name}
        </span>
        {/* P2P / relay badge */}
        <ConnectionBadge status={peerStatus} />
      </div>

      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span style={{ fontSize: '9px', color: '#fff' }}>
          {blip.status === 'LOST' ? '???' : blip.pellets}
          {blip.status !== 'LOST' && (
            <span style={{ fontSize: '6px', color: '#555', marginLeft: '2px' }}>PEL</span>
          )}
        </span>
        <span
          style={{
            fontSize: '7px',
            color: proximityColor,
            background: proximityColor + '22',
            padding: '2px 4px',
            borderRadius: '3px',
          }}
        >
          {blip.status}
        </span>
      </div>

      {blip.isStale && blip.status !== 'LOST' && (
        <div style={{ fontSize: '6px', color: '#555', marginTop: '2px' }}>
          {isP2P ? 'P2P WEAK' : 'SIGNAL LOST'}
        </div>
      )}
    </div>
  );
}

function ConnectionBadge({ status }: { status: PeerStatus | undefined }) {
  if (!status || status === 'connecting') return null;

  const cfg = {
    connected: { label: 'P2P', color: '#00FFFF', bg: '#001a1a' },
    disconnected: { label: 'RELAY', color: '#888', bg: '#111' },
    failed: { label: 'RELAY', color: '#888', bg: '#111' },
  }[status];

  return (
    <span
      style={{
        fontSize: '6px',
        color: cfg.color,
        background: cfg.bg,
        padding: '1px 4px',
        borderRadius: '2px',
        flexShrink: 0,
        border: `1px solid ${cfg.color}44`,
      }}
    >
      {cfg.label}
    </span>
  );
}
