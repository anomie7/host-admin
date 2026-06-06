import React from 'react';
import ChatPanel from './ChatPanel';

export default function SidePanel() {
  return (
    <aside className="side-panel" aria-label="AI 어시스턴트">
      <div className="side-panel-header">
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>💬 AI 어시스턴트</span>
      </div>
      <div className="side-panel-body">
        <ChatPanel />
      </div>
    </aside>
  );
}
