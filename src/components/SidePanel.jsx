import React from 'react';
import ChatPanel from './ChatPanel';

export default function SidePanel({ mobileOpen, onMobileClose }) {
  const isMobileOverlay = mobileOpen !== undefined;
  const panelClass = `side-panel${isMobileOverlay && mobileOpen ? ' side-panel--open' : ''}`;

  return (
    <aside className={panelClass} aria-label="AI 어시스턴트">
      <div className="side-panel-header">
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>💬 AI 어시스턴트</span>
        {isMobileOverlay && (
          <button className="side-panel-close" onClick={onMobileClose} aria-label="닫기" style={{
            background: 'none', border: 'none', color: 'var(--text-dim)',
            fontSize: 18, cursor: 'pointer', padding: '4px 8px', borderRadius: 4,
          }}>✕</button>
        )}
      </div>
      <div className="side-panel-body">
        <ChatPanel />
      </div>
    </aside>
  );
}
