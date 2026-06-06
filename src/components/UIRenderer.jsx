import React from 'react';
import BookingListMini from './BookingListMini';
import BookingDetailMini from './BookingDetailMini';
import StatsCardMini from './StatsCardMini';
import PropertyCardMini from './PropertyCardMini';
import ChartWidget from './ChartWidget';
import LayoutWidget from './LayoutWidget';

export default function UIRenderer({ ui, onAddToCanvas, compact }) {
  if (!ui || !ui.type) return null;

  const renderComponent = () => {
    switch (ui.type) {
      case 'booking-list':
        return <BookingListMini {...ui.props} />;
      case 'booking-detail':
        return <BookingDetailMini {...ui.props} />;
      case 'stats-card':
        return <StatsCardMini {...ui.props} />;
      case 'property-card':
        return <PropertyCardMini {...ui.props} />;
      case 'chart':
        return <ChartWidget {...ui.props} />;
      case 'layout':
        return <LayoutWidget columns={ui.props?.columns} children={ui.props?.children} gap={ui.props?.gap} />;
      default:
        return null;
    }
  };

  const component = renderComponent();
  if (!component) return null;

  // In canvas (compact mode), no add button needed
  if (compact) return component;

  return (
    <div>
      {component}
      {onAddToCanvas && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 4, fontSize: 11, color: 'var(--secondary)' }}
          onClick={() => onAddToCanvas({ type: ui.type, props: ui.props })}
        >
          🎨 캔버스에 추가
        </button>
      )}
    </div>
  );
}
