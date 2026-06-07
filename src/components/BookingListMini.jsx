import React, { useState } from 'react';
import { api } from '../api';

const statusLabels = {
  upcoming: '입실 예정',
  checked_in: '입실 중',
  checked_out: '퇴실 완료',
  cancelled: '취소됨',
};

const statusColors = {
  upcoming: '#f59e0b',
  checked_in: '#10b981',
  checked_out: '#6b7280',
  cancelled: '#ef4444',
};

const statusFlow = {
  upcoming: ['checked_in', 'cancelled'],
  checked_in: ['checked_out', 'cancelled'],
  checked_out: [],
  cancelled: [],
};

const actionLabels = {
  checked_in: '입실 중으로',
  checked_out: '퇴실 처리',
  cancelled: '입실 취소',
};

function formatWon(amount) {
  return `₩${Number(amount).toLocaleString()}`;
}

export default function BookingListMini({ title, bookings: initialBookings }) {
  const [bookings, setBookings] = useState(initialBookings || []);
  const [savingId, setSavingId] = useState(null);

  if (!bookings || bookings.length === 0) {
    return (
      <div className="mini-card">
        <p style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', padding: 12 }}>
          예약이 없습니다
        </p>
      </div>
    );
  }

  const handleStatusChange = async (bookingId, newStatus) => {
    setSavingId(bookingId);
    try {
      const updated = await api.updateBooking(bookingId, { status: newStatus });
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: updated.status } : b));
    } catch (err) {
      alert('상태 변경 실패: ' + err.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mini-card">
      {title && <div className="mini-card-title">{title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {bookings.map(b => {
          const guestName = b.guest_name || b.guestName || b.guest || '게스트';
          const propertyName = b.property_name || b.propertyName || b.property || '';
          const checkIn = b.check_in || b.checkIn || '';
          const checkOut = b.check_out || b.checkOut || '';
          const status = b.status || '';
          const amount = b.amount || 0;
          const platform = b.platform || '';
          const id = b.id || '';

          const nextStatuses = statusFlow[status] || [];
          return (
            <div key={id} className="mini-booking-item">
              {/* Primary: property name + status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {propertyName || '(숙소 정보 없음)'}
                    </span>
                    {id ? <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>#{id}</span> : null}
                  </div>
                </div>
                <span className={`badge badge-${status}`} style={{
                  fontSize: 10, flexShrink: 0, background: statusColors[status] || '#999',
                  color: '#fff', padding: '1px 8px', borderRadius: 10, fontWeight: 600,
                }}>
                  {statusLabels[status] || status}
                </span>
              </div>

              {/* Guest + date */}
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {guestName}
                </span>
                <span>
                  {checkIn ? `${checkIn.slice(5)}→${checkOut ? checkOut.slice(5) : ''}` : '날짜 정보 없음'}
                </span>
              </div>

              {/* Amount + platform */}
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
                <span>{amount ? formatWon(amount) : ''}</span>
                <span>{platform ? platform : ''}</span>
              </div>

              {/* Quick status change buttons */}
              {nextStatuses.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  {nextStatuses.map(s => (
                    <button
                      key={s}
                      className={`btn btn-sm ${s === 'cancelled' ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => handleStatusChange(id, s)}
                      disabled={savingId === id}
                      style={{ fontSize: 10, padding: '2px 8px' }}
                    >
                      {savingId === id ? '...' : (actionLabels[s] || statusLabels[s])}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
