import React from 'react';
import { useCanvas } from '../context/CanvasContext';
import UIRenderer from './UIRenderer';

export default function CanvasPanel() {
  const { items, canvasTitle, removeItem, clearItems } = useCanvas();

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🎨</div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
          캔버스
        </h3>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          채팅에서 "캔버스에 띄워줘"라고 말하면<br />
          AI가 생성한 UI 컴포넌트가 여기에 표시됩니다.
        </p>
        <p style={{ fontSize: 12, marginTop: 16, color: 'var(--text-dim)' }}>
          예: "한눈에 보기 좋게 대시보드 만들어줘"
        </p>
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
