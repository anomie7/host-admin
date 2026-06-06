import React from 'react';
import ChatPanel from './ChatPanel';

export default function SidePanel({ open, onClose, onToggle, isMobile }) {
  const panelClass = `side-panel${open ? ' side-panel--open' : ''}`;

  return (
    <>
      {!isMobile && (
        <div className="side-panel-collapse" onClick={onToggle} title={open ? '접기' : '펼치기'}>
          <span style={{ transform: open ? 'rotate(0deg)' : 'rotate(180deg)', display: 'inline-block' }}>◀</span>
        </div>
      )}
      <aside className={panelClass} aria-label="AI 어시스턴트">
        <div className="side-panel-header">
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>💬 AI 어시스턴트</span>
          {isMobile && (
            <button className="side-panel-close" onClick={onClose} aria-label="닫기">✕</button>
          )}
        </div>
        <div className="side-panel-body">
          <ChatPanel />
        </div>
      </aside>
    </>
  );
}
