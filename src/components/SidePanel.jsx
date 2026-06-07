import React, { useState, useCallback, useRef, useEffect } from 'react';
import ChatPanel from './ChatPanel';

const STORAGE_KEY = 'sidepanel_width';
const MIN_WIDTH = 300;
const MAX_WIDTH = 800;

function loadWidth() {
  try {
    const w = localStorage.getItem(STORAGE_KEY);
    return w ? Math.min(Math.max(parseInt(w), MIN_WIDTH), MAX_WIDTH) : null;
  } catch { return null; }
}

export default function SidePanel({ open, onClose, onToggle, isMobile }) {
  const [panelWidth, setPanelWidth] = useState(loadWidth);
  const [viewportHeight, setViewportHeight] = useState('100vh');
  const resizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const panelRef = useRef(null);

  // Mobile keyboard adjustment via visualViewport API
  useEffect(() => {
    if (!isMobile) return;
    const handleResize = () => {
      if (window.visualViewport) {
        const vh = window.visualViewport.height;
        const full = window.screen?.height || window.innerHeight;
        if (vh < full * 0.85) {
          // Keyboard is likely open — use visualViewport height
          setViewportHeight(`${vh}px`);
        } else {
          setViewportHeight('100dvh');
        }
      }
    };
    handleResize();
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, [isMobile]);

  // Apply custom width to panel (desktop only)
  useEffect(() => {
    if (!isMobile && panelRef.current && panelWidth) {
      panelRef.current.style.setProperty('--panel-width', `${panelWidth}px`);
    }
  }, [panelWidth, isMobile]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    resizing.current = true;
    startX.current = e.clientX;
    const currentW = panelRef.current?.offsetWidth || 440;
    startWidth.current = currentW;

    const handleMouseMove = (ev) => {
      if (!resizing.current) return;
      const diff = startX.current - ev.clientX;
      const newWidth = Math.min(Math.max(startWidth.current + diff, MIN_WIDTH), MAX_WIDTH);
      if (panelRef.current) {
        panelRef.current.style.width = `${newWidth}px`;
        panelRef.current.style.flexShrink = '0';
      }
    };

    const handleMouseUp = () => {
      if (!resizing.current) return;
      resizing.current = false;
      const finalWidth = panelRef.current?.offsetWidth || 440;
      setPanelWidth(finalWidth);
      try { localStorage.setItem(STORAGE_KEY, String(finalWidth)); } catch {}
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const panelClass = `side-panel${open ? ' side-panel--open' : ''}`;

  return (
    <>
      {!isMobile && (
        <div className="side-panel-collapse" onClick={onToggle} title={open ? '접기' : '펼치기'}>
          {/* Resize handle (small vertical strip within collapse) */}
          <div
            className="side-panel-resize"
            onMouseDown={handleMouseDown}
            title="드래그하여 너비 조절"
          />
          <span style={{ transform: open ? 'rotate(0deg)' : 'rotate(180deg)', display: 'inline-block', transition: 'transform 200ms ease', pointerEvents: 'none' }}>▶</span>
        </div>
      )}
      <aside
        ref={panelRef}
        className={panelClass}
        aria-label="AI 어시스턴트"
        style={!isMobile && panelWidth && open ? { width: panelWidth, minWidth: MIN_WIDTH } : isMobile && open ? { height: viewportHeight } : undefined}
      >
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
