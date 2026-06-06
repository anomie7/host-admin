import React from 'react';
import { useCanvas } from '../context/CanvasContext';
import UIRenderer from './UIRenderer';

export default function CanvasPanel() {
  const { items, canvasTitle, currentSession, removeItem, clearItems, createSession } = useCanvas();

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🎨</div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
          캔버스
        </h3>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          {currentSession ? '캔버스가 비어있어요' : '아직 캔버스가 없어요'}
          <br />
          AI에게 "대쉬보드로 만들어봐"라고 말해보세요.
        </p>
        {!currentSession && (
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: 16 }}
            onClick={() => createSession('새 캔버스', [])}
          >
            ✚ 새 캔버스
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
          {canvasTitle || '대시보드'}
        </h3>
        <button className="btn btn-ghost btn-sm" onClick={clearItems} style={{ color: 'var(--danger)' }}>
          전체 삭제
        </button>
      </div>

      {/* Canvas grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item) => (
          <div key={item.id} className="canvas-item">
            <div className="canvas-item-header">
              <span className="canvas-item-label">{componentLabel(item.type)}</span>
              <button
                className="canvas-item-remove"
                onClick={() => removeItem(item.id)}
                aria-label="삭제"
              >
                ✕
              </button>
            </div>
            <UIRenderer ui={{ type: item.type, props: item.props }} compact />
          </div>
        ))}
      </div>
    </div>
  );
}

function componentLabel(type) {
  const labels = {
    'booking-list': '📋 예약 목록',
    'booking-detail': '📄 예약 상세',
    'stats-card': '📊 통계',
    'property-card': '🏠 숙소 정보',
  };
  return labels[type] || type;
}
