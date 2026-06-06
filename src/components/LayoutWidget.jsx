import React from 'react';
import UIRenderer from './UIRenderer';

export default function LayoutWidget({ columns, children: items, gap }) {
  if (!items || items.length === 0) return null;

  const colCount = columns || (items.length >= 3 ? 2 : 1);
  const gapSize = gap || 12;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${colCount}, 1fr)`,
      gap: gapSize,
    }}>
      {items.map((child, i) => (
        <div key={child.id || i} className="mini-card" style={{ padding: 12, margin: 0 }}>
          <UIRenderer ui={{ type: child.type, props: child.props }} compact />
        </div>
      ))}
    </div>
  );
}
