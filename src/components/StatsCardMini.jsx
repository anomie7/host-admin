import React from 'react';

export default function StatsCardMini({ label, value, subtext }) {
  return (
    <div className="mini-card" style={{ textAlign: 'center', padding: 16 }}>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontSize: 22,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        color: 'var(--accent)',
      }}>
        {value}
      </div>
      {subtext && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
          {subtext}
        </div>
      )}
    </div>
  );
}
