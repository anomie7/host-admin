import React from 'react';
import { useSidePanel } from '../context/SidePanelContext';
import ChatPanel from './ChatPanel';
import CanvasPanel from './CanvasPanel';

export default function SidePanel() {
  const { isOpen, activeTab, setActiveTab, close } = useSidePanel();

  return (
    <>
      {isOpen && <div className="side-overlay" onClick={close} />}
      <aside className={`side-panel ${isOpen ? 'side-panel--open' : ''}`} aria-label="AI 어시스턴트">
        <div className="side-panel-header">
          <div className="side-tabs">
            <button
              className={`side-tab ${activeTab === 'chat' ? 'side-tab--active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              💬 채팅
            </button>
            <button
              className={`side-tab ${activeTab === 'canvas' ? 'side-tab--active' : ''}`}
              onClick={() => setActiveTab('canvas')}
            >
              🎨 캔버스
            </button>
          </div>
          <button className="side-panel-close" onClick={close} aria-label="닫기">✕</button>
        </div>
        <div className="side-panel-body">
          {activeTab === 'chat' ? <ChatPanel /> : <CanvasPanel />}
        </div>
      </aside>
    </>
  );
}
