import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import cors from 'cors';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Member,
  GhostColor,
  PartyPhase,
  Coordinates,
} from './types.js';

// ─── Party Data Structure ──────────────────────────────────────────────────────

interface ServerParty {
  code: string;
  phase: PartyPhase;
  members: Map<string, Member>;
  hostId: string;
}

const parties = new Map<string, ServerParty>();
const socketToParty = new Map<string, string>();

// ─── Party Code Generation ─────────────────────────────────────────────────────

// Excludes I, O, 0, 1 to avoid ambiguity on mobile screens in dark venues
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generatePartyCode(): string {
  let code: string;
  do {
    code = Array.from(
      { length: 4 },
      () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (parties.has(code));
  return code;
}

// ─── Color Assignment ──────────────────────────────────────────────────────────

const GHOST_COLORS: GhostColor[] = ['blinky', 'pinky', 'inky', 'clyde'];

function assignColor(party: ServerParty): GhostColor {
  const usedColors = new Set([...party.members.values()].map((m) => m.color));
  return (
    GHOST_COLORS.find((c) => !usedColors.has(c)) ??
    GHOST_COLORS[party.members.size % 4]
  );
}

// ─── Express + Socket.io Setup ─────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? false
        : ['http://localhost:5173', 'http://localhost:4173'],
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', parties: parties.size });
});

// In production: serve the built React app
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ─── Socket.io Event Handlers ──────────────────────────────────────────────────

io.on('connection', (socket) => {
  socket.on('join-party', ({ code, name }) => {
    name = name.trim().slice(0, 20);
    if (!name) {
      socket.emit('error', { message: 'Name is required.' });
      return;
    }

    const isCreating = !code || code.trim() === '';
    let party: ServerParty;

    if (isCreating) {
      const newCode = generatePartyCode();
      party = {
        code: newCode,
        phase: 'lobby',
        members: new Map(),
        hostId: socket.id,
      };
      parties.set(newCode, party);
    } else {
      const normalised = code.trim().toUpperCase();
      const found = parties.get(normalised);
      if (!found) {
        socket.emit('error', { message: `Party "${normalised}" not found.` });
        return;
      }
      if (found.phase === 'active') {
        socket.emit('error', { message: 'That party already started.' });
        return;
      }
      party = found;
    }

    const member: Member = {
      id: socket.id,
      name,
      color: assignColor(party),
      isHost: isCreating || party.members.size === 0,
      location: null,
    };

    party.members.set(socket.id, member);
    socketToParty.set(socket.id, party.code);
    socket.join(party.code);

    socket.emit('party-joined', {
      party: {
        code: party.code,
        phase: party.phase,
        members: [...party.members.values()],
      },
      you: member,
    });

    socket.to(party.code).emit('member-joined', member);
  });

  socket.on('location-update', (coords) => {
    const partyCode = socketToParty.get(socket.id);
    if (!partyCode) return;
    const party = parties.get(partyCode);
    if (!party || party.phase !== 'active') return;

    const location: Coordinates = { ...coords, timestamp: Date.now() };
    const member = party.members.get(socket.id);
    if (member) member.location = location;

    socket.to(partyCode).emit('location-broadcast', {
      id: socket.id,
      location,
    });
  });

  socket.on('start-party', () => {
    const partyCode = socketToParty.get(socket.id);
    if (!partyCode) return;
    const party = parties.get(partyCode);
    if (!party || party.hostId !== socket.id || party.phase !== 'lobby') return;

    party.phase = 'active';
    io.to(partyCode).emit('party-started');
  });

  socket.on('leave-party', () => {
    handleLeave(socket.id);
  });

  socket.on('disconnect', () => {
    handleLeave(socket.id);
  });
});

// ─── Leave Logic ──────────────────────────────────────────────────────────────

function handleLeave(socketId: string): void {
  const partyCode = socketToParty.get(socketId);
  if (!partyCode) return;

  const party = parties.get(partyCode);
  socketToParty.delete(socketId);
  if (!party) return;

  const leavingMember = party.members.get(socketId);
  party.members.delete(socketId);

  if (party.members.size === 0) {
    parties.delete(partyCode);
    return;
  }

  if (leavingMember) {
    io.to(partyCode).emit('member-left', {
      id: socketId,
      name: leavingMember.name,
    });
  }

  if (party.hostId === socketId) {
    io.to(partyCode).emit('party-ended', 'The host left the party.');
    for (const [sid] of party.members) {
      socketToParty.delete(sid);
    }
    parties.delete(partyCode);
  }
}

// ─── Start Server ──────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3001);
httpServer.listen(PORT, () => {
  console.log(`[pac-finder] Server running on http://localhost:${PORT}`);
});
