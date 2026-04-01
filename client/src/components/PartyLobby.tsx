import { useState } from 'react';
import type { PartyState, Member } from '../types/index.ts';
import { GHOST_HEX } from '../types/index.ts';

interface Props {
  party: PartyState;
  myMember: Member;
  onStart: () => void;
  onLeave: () => void;
}

export function PartyLobby({ party, myMember, onStart, onLeave }: Props) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(party.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const canStart = myMember.isHost && party.members.length >= 2;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        background: '#000',
        padding: '24px',
        gap: '24px',
      }}
    >
      <h2
        style={{
          fontSize: '12px',
          color: '#FFE000',
          margin: '0',
          textAlign: 'center',
          textShadow: '0 0 10px #FFE000',
        }}
      >
        PARTY LOBBY
      </h2>

      {/* Party Code Card */}
      <div
        style={{
          background: '#111',
          border: '2px solid #FFE000',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
          boxShadow: '0 0 20px #FFE00033',
        }}
      >
        <div style={{ fontSize: '8px', color: '#888', marginBottom: '8px', letterSpacing: '2px' }}>
          PARTY CODE
        </div>
        <div
          style={{
            fontSize: '36px',
            color: '#FFE000',
            letterSpacing: '10px',
            textShadow: '0 0 20px #FFE000',
            marginBottom: '12px',
          }}
        >
          {party.code}
        </div>
        <button
          onClick={copyCode}
          style={{
            background: copied ? '#003300' : '#1a1a00',
            border: `1px solid ${copied ? '#00ff00' : '#FFE000'}`,
            color: copied ? '#00ff00' : '#FFE000',
            padding: '8px 16px',
            fontSize: '9px',
            fontFamily: 'inherit',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
        >
          {copied ? 'COPIED!' : 'COPY CODE'}
        </button>
        <div style={{ fontSize: '8px', color: '#555', marginTop: '10px' }}>
          Share this code with your crew
        </div>
      </div>

      {/* Member List */}
      <div>
        <div style={{ fontSize: '9px', color: '#888', marginBottom: '12px', letterSpacing: '1px' }}>
          CREW ({party.members.length}/8)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {party.members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isMe={member.id === myMember.id}
            />
          ))}
        </div>
        {party.members.length < 2 && (
          <div
            style={{
              fontSize: '8px',
              color: '#555',
              textAlign: 'center',
              marginTop: '12px',
              lineHeight: '1.8',
            }}
          >
            Waiting for friends to join...
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {myMember.isHost && (
          <button
            onClick={onStart}
            disabled={!canStart}
            style={{
              background: canStart ? '#FFE000' : '#333',
              color: canStart ? '#000' : '#666',
              border: 'none',
              padding: '16px',
              fontSize: '12px',
              fontFamily: 'inherit',
              cursor: canStart ? 'pointer' : 'not-allowed',
              borderRadius: '4px',
              boxShadow: canStart ? '0 0 20px #FFE00066' : 'none',
            }}
          >
            {canStart ? 'START RADAR' : `NEED ${2 - party.members.length} MORE`}
          </button>
        )}
        {!myMember.isHost && (
          <div
            style={{
              fontSize: '8px',
              color: '#555',
              textAlign: 'center',
              padding: '12px',
              background: '#111',
              borderRadius: '4px',
              lineHeight: '1.8',
            }}
          >
            Waiting for host to start...
          </div>
        )}
        <button
          onClick={onLeave}
          style={{
            background: 'transparent',
            border: '1px solid #333',
            color: '#888',
            padding: '12px',
            fontSize: '9px',
            fontFamily: 'inherit',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
        >
          LEAVE PARTY
        </button>
      </div>
    </div>
  );
}

function MemberRow({ member, isMe }: { member: Member; isMe: boolean }) {
  const color = GHOST_HEX[member.color];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: isMe ? '#0a0a0a' : '#111',
        border: `1px solid ${isMe ? color : '#222'}`,
        borderRadius: '6px',
        padding: '10px 14px',
        boxShadow: isMe ? `0 0 10px ${color}33` : 'none',
      }}
    >
      {/* Ghost icon */}
      <GhostMini color={color} />

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '10px', color: isMe ? color : '#fff' }}>
          {member.name}
          {isMe && (
            <span style={{ fontSize: '7px', color: '#888', marginLeft: '8px' }}>
              (YOU)
            </span>
          )}
        </div>
      </div>

      {member.isHost && (
        <div
          style={{
            fontSize: '7px',
            color: '#FFE000',
            background: '#1a1a00',
            border: '1px solid #FFE000',
            padding: '2px 6px',
            borderRadius: '3px',
          }}
        >
          HOST
        </div>
      )}
    </div>
  );
}

function GhostMini({ color }: { color: string }) {
  return (
    <svg width="24" height="28" viewBox="0 0 20 24">
      <path
        d="M10 0 C4.5 0 0 4.5 0 10 L0 24 L3.3 20.7 L6.7 24 L10 20.7 L13.3 24 L16.7 20.7 L20 24 L20 10 C20 4.5 15.5 0 10 0 Z"
        fill={color}
      />
      <circle cx="7" cy="10" r="3" fill="white" />
      <circle cx="13" cy="10" r="3" fill="white" />
      <circle cx="8" cy="11" r="1.5" fill="#0000AA" />
      <circle cx="14" cy="11" r="1.5" fill="#0000AA" />
    </svg>
  );
}
