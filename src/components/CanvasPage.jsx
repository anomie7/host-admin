import React from 'react';
import { useCanvas } from '../context/CanvasContext';
import UIRenderer from './UIRenderer';

export default function CanvasPage() {
  const { items, canvasTitle, removeItem, clearItems } = useCanvas();

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>
            🎨 {canvasTitle || '캔버스'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            AI가 생성한 대시보드 컴포넌트들입니다
          </p>
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
            아직 캔버스가 비어있어요
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
            우측 AI 어시스턴트에게 <strong>"한눈에 보기 좋게 대시보드 만들어줘"</strong> 라고 말해보세요.
            <br /><br />
            또는 채팅에서 AI가 보여준 UI 카드의 <strong>"캔버스에 추가"</strong> 버튼을 눌러서
            하나씩 모아볼 수 있습니다.
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 24 }}
            onClick={() => {
              // Find and click the AI toggle button
              document.querySelector('button[aria-label="AI 어시스턴트"]')?.click();
            }}
          >
            💬 AI 어시스턴트 열기
          </button>
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
  };
  return labels[type] || type;
}
