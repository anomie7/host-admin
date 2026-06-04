import React from 'react';

export default function CanvasPanel() {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🎨</div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
        캔버스
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.6 }}>
        AI가 생성한 UI를 시각적으로 편집할 수 있는 공간입니다.
      </p>
      <p style={{ fontSize: 12, marginTop: 16, color: 'var(--text-dim)' }}>
        준비 중입니다...
      </p>
    </div>
  );
}
