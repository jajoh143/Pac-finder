import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './hooks/useSocket.ts';
import { HomeScreen } from './components/HomeScreen.tsx';
import { PartyLobby } from './components/PartyLobby.tsx';
import { RadarScreen } from './components/RadarScreen.tsx';
import type { Screen, PartyState, Member, Coordinates } from './types/index.ts';

export default function App() {
  const { socket, isConnected, emit } = useSocket();
  const [screen, setScreen] = useState<Screen>('home');
  const [party, setParty] = useState<PartyState | null>(null);
  const [myMember, setMyMember] = useState<Member | null>(null);
  const [locations, setLocations] = useState<Map<string, Coordinates>>(new Map());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('party-joined', ({ party, you }) => {
      setParty(party);
      setMyMember(you);
      setScreen('lobby');
      setErrorMsg(null);
    });

    socket.on('member-joined', (member) => {
      setParty((p) => (p ? { ...p, members: [...p.members, member] } : p));
    });

    socket.on('member-left', ({ id }) => {
      setParty((p) =>
        p ? { ...p, members: p.members.filter((m) => m.id !== id) } : p
      );
      setLocations((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    });

    socket.on('location-broadcast', ({ id, location }) => {
      setLocations((prev) => new Map(prev).set(id, location));
    });

    socket.on('party-started', () => {
      setParty((p) => (p ? { ...p, phase: 'active' } : p));
      setScreen('radar');
    });

    socket.on('party-ended', (reason) => {
      setErrorMsg(reason);
      setScreen('home');
      setParty(null);
      setMyMember(null);
      setLocations(new Map());
    });

    socket.on('error', ({ message }) => {
      setErrorMsg(message);
    });

    return () => {
      socket.off('party-joined');
      socket.off('member-joined');
      socket.off('member-left');
      socket.off('location-broadcast');
      socket.off('party-started');
      socket.off('party-ended');
      socket.off('error');
    };
  }, [socket]);

  const handleJoinOrCreate = useCallback(
    (name: string, code?: string) => {
      setErrorMsg(null);
      emit('join-party', { code: code ?? '', name });
    },
    [emit]
  );

  const handleStart = useCallback(() => {
    emit('start-party');
  }, [emit]);

  const handleLeave = useCallback(() => {
    emit('leave-party');
    setScreen('home');
    setParty(null);
    setMyMember(null);
    setLocations(new Map());
    setErrorMsg(null);
  }, [emit]);

  const handleEmitLocation = useCallback(
    (coords: Omit<typeof locations extends Map<string, infer V> ? V : never, 'timestamp'>) => {
      emit('location-update', coords);
    },
    [emit]
  );

  if (screen === 'lobby' && party && myMember) {
    return (
      <PartyLobby
        party={party}
        myMember={myMember}
        onStart={handleStart}
        onLeave={handleLeave}
      />
    );
  }

  if (screen === 'radar' && party && myMember) {
    return (
      <RadarScreen
        party={party}
        myMember={myMember}
        locations={locations}
        onLeave={handleLeave}
        emitLocation={handleEmitLocation}
      />
    );
  }

  return (
    <HomeScreen
      onJoin={handleJoinOrCreate}
      errorMsg={errorMsg}
      isConnected={isConnected}
    />
  );
}
