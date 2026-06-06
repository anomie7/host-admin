import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import SidePanel from './SidePanel';

const IconDashboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const IconBuilding = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <line x1="9" y1="6" x2="9" y2="6.01" />
    <line x1="15" y1="6" x2="15" y2="6.01" />
    <line x1="9" y1="10" x2="9" y2="10.01" />
    <line x1="15" y1="10" x2="15" y2="10.01" />
    <line x1="9" y1="14" x2="9" y2="14.01" />
    <line x1="15" y1="14" x2="15" y2="14.01" />
    <line x1="9" y1="18" x2="15" y2="18" />
  </svg>
);
const IconCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconCanvas = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
    <circle cx="7.5" cy="6" r=".5" fill="currentColor" />
    <circle cx="10.5" cy="6" r=".5" fill="currentColor" />
    <circle cx="13.5" cy="6" r=".5" fill="currentColor" />
  </svg>
);

export default function Layout({ children, title }) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const togglePanel = () => setPanelOpen(prev => !prev);
  const closePanel = () => setPanelOpen(false);

  return (
    <div className="app-layout">
      <nav className="sidebar" aria-label="메인 내비게이션">
        <div className="sidebar-logo" aria-hidden="true">H</div>
        <div className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} aria-label="대시보드">
            <IconDashboard />
          </NavLink>
          <NavLink to="/properties" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} aria-label="숙소">
            <IconBuilding />
          </NavLink>
          <NavLink to="/calendar" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} aria-label="캘린더">
            <IconCalendar />
          </NavLink>
          <NavLink to="/canvas" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} aria-label="캔버스">
            <IconCanvas />
          </NavLink>
        </div>
      </nav>
      <div className="main-area">
        <header className="main-header">
          <h1>{title || '호스트 관리자'}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isMobile ? (
              <button onClick={togglePanel} aria-label="AI 어시스턴트" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '8px 16px', borderRadius: 20,
                border: '1px solid', borderColor: panelOpen ? 'var(--accent-dim)' : 'var(--border)',
                background: panelOpen ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                color: panelOpen ? 'var(--accent)' : 'var(--text-dim)',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                fontFamily: 'var(--font-ui)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                <span style={{ fontSize: 15 }}>💬</span>
                <span>{panelOpen ? '접기' : 'AI 채팅'}</span>
              </button>
            ) : (
              <button onClick={togglePanel} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 18px', borderRadius: 20,
                border: '1px solid', borderColor: panelOpen ? 'var(--accent-dim)' : 'var(--border)',
                background: panelOpen ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                color: panelOpen ? 'var(--accent)' : 'var(--text-dim)',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                fontFamily: 'var(--font-ui)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 150ms ease',
              }}>
                <span style={{ fontSize: 15 }}>💬</span>
                <span>{panelOpen ? 'AI 채팅 접기' : 'AI 채팅 열기'}</span>
                <span style={{
                  fontSize: 11, display: 'inline-block',
                  transform: panelOpen ? 'rotate(0deg)' : 'rotate(180deg)',
                  transition: 'transform 200ms ease',
                }}>▶</span>
              </button>
            )}
            <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'var(--font-display)' }}>Warm Stay</span>
          </div>
        </header>
        <main className="main-content stagger">
          {children}
        </main>
      </div>

      {isMobile && panelOpen && <div className="side-overlay" onClick={closePanel} />}
      <SidePanel open={panelOpen} onClose={closePanel} onToggle={togglePanel} isMobile={isMobile} />
    </div>
  );
}
