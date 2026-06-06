import React from 'react';
import { useSidePanel } from '../context/SidePanelContext';
import ChatPanel from './ChatPanel';

export default function SidePanel() {
  const { isOpen, close } = useSidePanel();

  return (
    <>
      {isOpen && <div className="side-overlay" onClick={close} />}
      <aside className={`side-panel ${isOpen ? 'side-panel--open' : ''}`} aria-label="AI 어시스턴트">
        <div className="side-panel-header">
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>💬 AI 어시스턴트</span>
          <button className="side-panel-close" onClick={close} aria-label="닫기">✕</button>
        </div>
        <div className="side-panel-body">
          <ChatPanel />
        </div>
      </aside>
    </>
  );
}
