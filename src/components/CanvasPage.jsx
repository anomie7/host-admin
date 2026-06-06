import React, { useState, useRef, useEffect } from 'react';
import { useCanvas } from '../context/CanvasContext';
import UIRenderer from './UIRenderer';

export default function CanvasPage() {
  const {
    items, canvasTitle, sessions, currentSession, currentId,
    removeItem, clearItems, loadSession, createSession, deleteSession, renameSession,
  } = useCanvas();

  const [showMenu, setShowMenu] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const menuRef = useRef(null);
  const editRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus();
  }, [editingId]);

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      clearItems();
      return;
    }
    if (window.confirm('이 캔버스를 삭제할까요?')) deleteSession(id);
  };

  const handleRename = (id, e) => {
    e.stopPropagation();
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    setEditingId(id);
    setEditTitle(session.title);
  };

  const submitRename = (id) => {
    if (editTitle.trim()) renameSession(id, editTitle.trim());
    setEditingId(null);
  };

  const handleNew = () => {
    createSession('새 캔버스', []);
    setShowMenu(false);
  };

  return (
    <div>
      {/* Header with session controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              className="btn btn-ghost"
              onClick={() => setShowMenu(prev => !prev)}
              style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 600, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              🎨 {currentSession?.title || '캔버스'}
              <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
            </button>

            {showMenu && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 60,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                minWidth: 220, overflow: 'hidden', animation: 'fadeIn 150ms ease',
              }}>
                {sessions.map(s => (
                  <div
                    key={s.id}
                    className="chat-session-item"
                    style={{
                      background: s.id === currentId ? 'var(--accent-glow)' : 'transparent',
                      color: s.id === currentId ? 'var(--accent)' : 'var(--text-primary)',
                      fontWeight: s.id === currentId ? 500 : 400,
                    }}
                    onClick={() => { loadSession(s.id); setShowMenu(false); }}
                    onDoubleClick={(e) => handleRename(s.id, e)}
                  >
                    {editingId === s.id ? (
                      <input
                        ref={editRef}
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={() => submitRename(s.id)}
                        onKeyDown={e => { if (e.key === 'Enter') submitRename(s.id); if (e.key === 'Escape') setEditingId(null); }}
                        style={{
                          flex: 1, border: '1px solid var(--accent)', borderRadius: 4,
                          padding: '2px 6px', fontSize: 13, background: 'var(--bg-primary)',
                          color: 'var(--text-primary)', outline: 'none',
                        }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.title}
                      </span>
                    )}
                    <button
                      className="chat-session-del"
                      onClick={(e) => handleDelete(s.id, e)}
                      title="삭제"
                      style={{ opacity: 0 }}
                    >✕</button>
                  </div>
                ))}
                <div
                  className="chat-session-item chat-session-item--new"
                  onClick={handleNew}
                >
                  ✚ 새 캔버스
                </div>
              </div>
            )}
          </div>

          {items.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{items.length}개 아이템</span>
          )}
        </div>

        {items.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={clearItems}>
            전체 초기화
          </button>
        )}
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎨</div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
            {currentSession ? '아직 캔버스가 비어있어요' : '캔버스가 없어요'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
            AI 어시스턴트에게 <strong>"대쉬보드로 만들어봐"</strong> 라고 말해보세요.
            <br /><br />
            또는 채팅에서 AI가 보여준 UI 카드의 <strong>"캔버스에 추가"</strong> 버튼을 눌러서
            하나씩 모아볼 수 있습니다.
          </p>
        </div>
      ) : (
        /* Canvas grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {items.map((item) => (
            <div key={item.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 16px', background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-light)',
              }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                  {componentLabel(item.type)}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--text-dim)', fontSize: 11 }}
                  onClick={() => removeItem(item.id)}
                >
                  ✕ 제거
                </button>
              </div>
              <div style={{ padding: 16 }}>
                <UIRenderer ui={{ type: item.type, props: item.props }} compact />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function componentLabel(type) {
  const labels = {
    'booking-list': '📋 예약 목록',
    'booking-detail': '📄 예약 상세',
    'stats-card': '📊 통계',
    'property-card': '🏠 숙소 정보',
    'chart': '📈 차트',
    'layout': '📐 레이아웃',
    'table': '📋 표',
    'html': '🔧 커스텀',
  };
  return labels[type] || type;
}
