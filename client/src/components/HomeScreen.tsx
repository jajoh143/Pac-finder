import { useState } from 'react';

interface Props {
  onJoin: (name: string, code?: string) => void;
  errorMsg: string | null;
  isConnected: boolean;
}

export function HomeScreen({ onJoin, errorMsg, isConnected }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join' | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onJoin(name.trim(), mode === 'join' ? code : undefined);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
        background: '#000',
        padding: '24px',
        gap: '24px',
      }}
    >
      {/* Connection indicator */}
      <div
        style={{
          position: 'fixed',
          top: '12px',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '8px',
          color: isConnected ? '#00ff00' : '#ff4444',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isConnected ? '#00ff00' : '#ff4444',
            boxShadow: isConnected ? '0 0 6px #00ff00' : '0 0 6px #ff4444',
          }}
        />
        {isConnected ? 'ONLINE' : 'OFFLINE'}
      </div>

      {/* Logo */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: '36px',
            marginBottom: '8px',
          }}
        >
          {/* Pac-Man SVG */}
          <svg width="80" height="80" viewBox="0 0 80 80" style={{ display: 'block', margin: '0 auto' }}>
            <circle cx="40" cy="40" r="38" fill="#FFE000" />
            <polygon points="40,40 78,25 78,55" fill="#000" />
            <circle cx="40" cy="20" r="5" fill="#000" />
          </svg>
        </div>
        <h1
          style={{
            fontSize: '22px',
            color: '#FFE000',
            margin: '0',
            textShadow: '0 0 20px #FFE000, 0 0 40px #FFE000',
            letterSpacing: '2px',
          }}
        >
          PAC-FINDER
        </h1>
        <p
          style={{
            fontSize: '8px',
            color: '#888',
            marginTop: '8px',
            letterSpacing: '1px',
          }}
        >
          FIND YOUR CREW AT THE RAVE
        </p>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div
          style={{
            background: '#2a0000',
            border: '1px solid #ff4444',
            borderRadius: '4px',
            padding: '12px 16px',
            fontSize: '8px',
            color: '#ff4444',
            maxWidth: '320px',
            textAlign: 'center',
            lineHeight: '1.6',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Mode selection or form */}
      {mode === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '300px' }}>
          <button
            onClick={() => setMode('create')}
            style={primaryButtonStyle('#FFE000', '#000')}
          >
            CREATE PARTY
          </button>
          <button
            onClick={() => setMode('join')}
            style={primaryButtonStyle('#00FFFF', '#000')}
          >
            JOIN PARTY
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            width: '100%',
            maxWidth: '300px',
          }}
        >
          <div style={{ fontSize: '10px', color: mode === 'create' ? '#FFE000' : '#00FFFF', textAlign: 'center' }}>
            {mode === 'create' ? '— CREATE A NEW PARTY —' : '— JOIN A PARTY —'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={labelStyle}>YOUR NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="PLAYER ONE"
              maxLength={20}
              autoComplete="off"
              style={inputStyle}
            />
          </div>

          {mode === 'join' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={labelStyle}>PARTY CODE</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4))}
                placeholder="ABCD"
                maxLength={4}
                autoComplete="off"
                style={{
                  ...inputStyle,
                  textAlign: 'center',
                  fontSize: '24px',
                  letterSpacing: '8px',
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={!name.trim() || (mode === 'join' && code.length < 4)}
            style={primaryButtonStyle(
              mode === 'create' ? '#FFE000' : '#00FFFF',
              '#000',
              !name.trim() || (mode === 'join' && code.length < 4)
            )}
          >
            {mode === 'create' ? 'CREATE' : 'JOIN'}
          </button>

          <button
            type="button"
            onClick={() => setMode(null)}
            style={{
              background: 'transparent',
              border: '1px solid #444',
              color: '#888',
              padding: '10px',
              fontSize: '9px',
              fontFamily: 'inherit',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            BACK
          </button>
        </form>
      )}

      {/* Ghost decoration */}
      <div
        style={{
          position: 'fixed',
          bottom: '16px',
          display: 'flex',
          gap: '16px',
          opacity: 0.3,
        }}
      >
        {(['#FF0000', '#FFB8FF', '#00FFFF', '#FFB852'] as const).map((color, i) => (
          <GhostIcon key={i} color={color} size={24} />
        ))}
      </div>
    </div>
  );
}

function GhostIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 20 24">
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

function primaryButtonStyle(bg: string, fg: string, disabled = false): React.CSSProperties {
  return {
    background: disabled ? '#333' : bg,
    color: disabled ? '#666' : fg,
    border: 'none',
    padding: '16px',
    fontSize: '12px',
    fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: '4px',
    width: '100%',
    boxShadow: disabled ? 'none' : `0 0 20px ${bg}66`,
    transition: 'all 0.1s',
  };
}

const labelStyle: React.CSSProperties = {
  fontSize: '8px',
  color: '#888',
  letterSpacing: '1px',
};

const inputStyle: React.CSSProperties = {
  background: '#111',
  border: '1px solid #333',
  color: '#fff',
  padding: '12px',
  fontSize: '12px',
  fontFamily: 'inherit',
  borderRadius: '4px',
  outline: 'none',
  width: '100%',
};
