import { useEffect, useRef, useMemo } from 'react';
import { useGeolocation } from '../hooks/useGeolocation.ts';
import { PacManRadar } from './PacManRadar.tsx';
import type { PartyState, Member, Coordinates, FriendBlip } from '../types/index.ts';
import { GHOST_HEX } from '../types/index.ts';
import {
  haversineDistance,
  bearing,
  distanceToPellets,
  getProximityStatus,
  isStaleLocation,
} from '../utils/geo.ts';

interface Props {
  party: PartyState;
  myMember: Member;
  locations: Map<string, Coordinates>;
  onLeave: () => void;
  emitLocation: (coords: Omit<Coordinates, 'timestamp'>) => void;
}

const EMIT_INTERVAL_MS = 2000;

const PROXIMITY_COLORS: Record<string, string> = {
  HOT: '#ff4444',
  WARM: '#ff8800',
  COLD: '#4488ff',
  LOST: '#444',
};

export function RadarScreen({ party, myMember, locations, onLeave, emitLocation }: Props) {
  const { coords, error: geoError, isWatching } = useGeolocation(true);
  const lastEmitRef = useRef<number>(0);

  // Throttle location emits to server
  useEffect(() => {
    if (!coords) return;
    const now = Date.now();
    if (now - lastEmitRef.current < EMIT_INTERVAL_MS) return;
    lastEmitRef.current = now;
    emitLocation({
      lat: coords.lat,
      lng: coords.lng,
      accuracy: coords.accuracy,
      heading: coords.heading,
    });
  }, [coords, emitLocation]);

  // Compute blips for all other members
  const blips = useMemo<FriendBlip[]>(() => {
    if (!coords) return [];

    return party.members
      .filter((m) => m.id !== myMember.id)
      .map((member) => {
        const loc = locations.get(member.id);
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
        return {
          member,
          bearing: bear,
          distance: dist,
          pellets: distanceToPellets(dist),
          status: getProximityStatus(dist),
          isStale: isStaleLocation(loc),
        };
      })
      .filter((b) => b.status !== 'LOST' || locations.has(b.member.id));
  }, [coords, party.members, myMember.id, locations]);

  const weakGps = coords && coords.accuracy !== undefined && coords.accuracy > 50;

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

        <div style={{ fontSize: '9px', color: '#FFE000' }}>
          PARTY {party.code}
        </div>

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

      {/* Main layout: radar + sidebar */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: window.innerWidth > 600 ? 'row' : 'column',
          overflow: 'hidden',
          alignItems: 'center',
        }}
      >
        {/* Radar canvas */}
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

        {/* Friend list */}
        {blips.length > 0 && (
          <div
            style={{
              width: window.innerWidth > 600 ? '180px' : '100%',
              maxHeight: window.innerWidth > 600 ? '100%' : '160px',
              overflowY: 'auto',
              borderLeft: window.innerWidth > 600 ? '1px solid #111' : 'none',
              borderTop: window.innerWidth > 600 ? 'none' : '1px solid #111',
              flexShrink: 0,
              padding: '8px',
              display: 'flex',
              flexDirection: window.innerWidth > 600 ? 'column' : 'row',
              flexWrap: window.innerWidth > 600 ? 'nowrap' : 'wrap',
              gap: '6px',
            }}
          >
            {blips.map((blip) => (
              <FriendCard key={blip.member.id} blip={blip} />
            ))}
          </div>
        )}
      </div>

      {/* No location yet overlay */}
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
          <div style={{ fontSize: '8px', color: '#555', textAlign: 'center', maxWidth: '240px', lineHeight: '1.8' }}>
            Allow location access when prompted
          </div>
        </div>
      )}
    </div>
  );
}

function FriendCard({ blip }: { blip: FriendBlip }) {
  const color = GHOST_HEX[blip.member.color];
  const proximityColor = PROXIMITY_COLORS[blip.status];

  return (
    <div
      style={{
        background: '#0a0a0a',
        border: `1px solid ${blip.isStale ? '#222' : color + '66'}`,
        borderRadius: '6px',
        padding: '8px',
        opacity: blip.isStale ? 0.5 : 1,
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
        <GhostDot color={color} />
        <span style={{ fontSize: '8px', color: color, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {blip.member.name}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '9px', color: '#fff' }}>
          {blip.status === 'LOST' ? '???' : `${blip.pellets}`}
          <span style={{ fontSize: '6px', color: '#555', marginLeft: '2px' }}>
            {blip.status !== 'LOST' ? 'PEL' : ''}
          </span>
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
          SIGNAL LOST
        </div>
      )}
    </div>
  );
}

function GhostDot({ color }: { color: string }) {
  return (
    <div
      style={{
        width: '10px',
        height: '10px',
        borderRadius: '50% 50% 40% 40%',
        background: color,
        flexShrink: 0,
      }}
    />
  );
}
