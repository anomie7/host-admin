import React from 'react';
import BookingListMini from './BookingListMini';
import BookingDetailMini from './BookingDetailMini';
import StatsCardMini from './StatsCardMini';
import PropertyCardMini from './PropertyCardMini';

export default function UIRenderer({ ui }) {
  if (!ui || !ui.type) return null;

  switch (ui.type) {
    case 'booking-list':
      return <BookingListMini {...ui.props} />;
    case 'booking-detail':
      return <BookingDetailMini {...ui.props} />;
    case 'stats-card':
      return <StatsCardMini {...ui.props} />;
    case 'property-card':
      return <PropertyCardMini {...ui.props} />;
    default:
      return null;
  }
}
