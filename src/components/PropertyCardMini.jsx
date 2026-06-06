import React from 'react';

export default function PropertyCardMini({ name, address, platforms }) {
  return (
    <div className="mini-card">
      <div className="mini-card-title">{name}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {address}
      </div>
      {platforms && platforms.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {platforms.map(p => (
            <span key={p} className="badge badge-upcoming" style={{ fontSize: 10 }}>
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
