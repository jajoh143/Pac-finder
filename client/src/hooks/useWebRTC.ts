import { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Coordinates,
  WebRTCSignal,
} from '../types/index.ts';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type PeerStatus = 'connecting' | 'connected' | 'disconnected' | 'failed';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useWebRTC(
  socket: AppSocket | null,
  myId: string,
  memberIds: string[],
  onLocationReceived: (fromId: string, coords: Coordinates) => void
) {
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const [peerStatuses, setPeerStatuses] = useState<Map<string, PeerStatus>>(new Map());

  // Always call with latest callback — avoids stale closures in channel.onmessage
  const onLocationReceivedRef = useRef(onLocationReceived);
  useEffect(() => { onLocationReceivedRef.current = onLocationReceived; });

  // Keep socket in a ref so ICE candidate handlers stay fresh after reconnects
  const socketRef = useRef(socket);
  useEffect(() => { socketRef.current = socket; }, [socket]);

  const updateStatus = useCallback((peerId: string, status: PeerStatus) => {
    setPeerStatuses((prev) => new Map(prev).set(peerId, status));
  }, []);

  const setupDataChannel = useCallback(
    (channel: RTCDataChannel, peerId: string) => {
      channelsRef.current.set(peerId, channel);

      channel.onopen = () => updateStatus(peerId, 'connected');
      channel.onclose = () => {
        channelsRef.current.delete(peerId);
        updateStatus(peerId, 'disconnected');
      };
      channel.onerror = () => updateStatus(peerId, 'failed');
      channel.onmessage = ({ data }) => {
        try {
          const msg = JSON.parse(data as string) as { type: string } & Coordinates;
          if (msg.type === 'location') {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { type: _t, ...coords } = msg;
            onLocationReceivedRef.current(peerId, coords as Coordinates);
          }
        } catch {
          // ignore malformed messages
        }
      };
    },
    [updateStatus]
  );

  const createPeer = useCallback(
    (peerId: string): RTCPeerConnection => {
      // Reuse existing non-failed connection
      const existing = peersRef.current.get(peerId);
      if (
        existing &&
        existing.connectionState !== 'closed' &&
        existing.connectionState !== 'failed'
      ) {
        return existing;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(peerId, pc);
      updateStatus(peerId, 'connecting');

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socketRef.current?.emit('webrtc-signal', {
            to: peerId,
            signal: { type: 'ice-candidate', payload: candidate.toJSON() },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        switch (pc.connectionState) {
          case 'connected':
            updateStatus(peerId, 'connected');
            break;
          case 'disconnected':
            updateStatus(peerId, 'disconnected');
            break;
          case 'failed':
            updateStatus(peerId, 'failed');
            pc.restartIce(); // attempt ICE restart before giving up
            break;
        }
      };

      return pc;
    },
    [updateStatus]
  );

  const initiateConnection = useCallback(
    async (peerId: string) => {
      if (!socketRef.current) return;
      const pc = createPeer(peerId);

      // Initiator creates the DataChannel
      // ordered:false + maxRetransmits:0 = unreliable, unordered (UDP-like)
      // Ideal for location: we only care about the latest position, not old ones
      const channel = pc.createDataChannel('loc', {
        ordered: false,
        maxRetransmits: 0,
      });
      setupDataChannel(channel, peerId);

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current.emit('webrtc-signal', {
          to: peerId,
          signal: { type: 'offer', payload: offer },
        });
      } catch (err) {
        console.warn('[WebRTC] offer failed for', peerId, err);
        updateStatus(peerId, 'failed');
      }
    },
    [createPeer, setupDataChannel, updateStatus]
  );

  // Handle incoming signals relayed by the server
  useEffect(() => {
    if (!socket) return;

    const handleSignal = async ({
      from,
      signal,
    }: {
      from: string;
      signal: WebRTCSignal;
    }) => {
      if (signal.type === 'offer') {
        const pc = createPeer(from);
        // Receiver waits for the DataChannel the initiator creates
        pc.ondatachannel = ({ channel }) => setupDataChannel(channel, from);

        try {
          await pc.setRemoteDescription(
            signal.payload as RTCSessionDescriptionInit
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc-signal', {
            to: from,
            signal: { type: 'answer', payload: answer },
          });
        } catch (err) {
          console.warn('[WebRTC] answer failed for', from, err);
          updateStatus(from, 'failed');
        }
      } else if (signal.type === 'answer') {
        const pc = peersRef.current.get(from);
        if (pc) {
          try {
            await pc.setRemoteDescription(
              signal.payload as RTCSessionDescriptionInit
            );
          } catch (err) {
            console.warn('[WebRTC] setRemoteDescription failed', err);
          }
        }
      } else if (signal.type === 'ice-candidate') {
        const pc = peersRef.current.get(from);
        if (pc?.remoteDescription) {
          try {
            await pc.addIceCandidate(
              signal.payload as RTCIceCandidateInit
            );
          } catch (err) {
            console.warn('[WebRTC] addIceCandidate failed', err);
          }
        }
      }
    };

    socket.on('webrtc-signal', handleSignal);
    return () => {
      socket.off('webrtc-signal', handleSignal);
    };
  }, [socket, createPeer, setupDataChannel, updateStatus]);

  // Initiate connections: member with the larger socket ID is the initiator
  // This ensures exactly one side initiates per pair (no collision)
  useEffect(() => {
    if (!socket || !myId) return;
    for (const peerId of memberIds) {
      if (myId > peerId && !peersRef.current.has(peerId)) {
        initiateConnection(peerId);
      }
    }
  }, [socket, myId, memberIds, initiateConnection]);

  // Cleanup all peer connections on unmount
  useEffect(() => {
    return () => {
      for (const pc of peersRef.current.values()) pc.close();
      peersRef.current.clear();
      channelsRef.current.clear();
    };
  }, []);

  /**
   * Send location to all peers with an open DataChannel.
   * Returns the number of peers reached via WebRTC.
   */
  const broadcastLocation = useCallback(
    (coords: Omit<Coordinates, 'timestamp'>): number => {
      const msg = JSON.stringify({
        type: 'location',
        ...coords,
        timestamp: Date.now(),
      });
      let sent = 0;
      for (const channel of channelsRef.current.values()) {
        if (channel.readyState === 'open') {
          try {
            channel.send(msg);
            sent++;
          } catch {
            // channel may have closed between the check and send
          }
        }
      }
      return sent;
    },
    []
  );

  return { peerStatuses, broadcastLocation };
}
