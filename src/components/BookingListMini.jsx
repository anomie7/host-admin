import React, { useState } from 'react';
import { api } from '../api';

const statusLabels = {
  upcoming: '입실 예정',
  checked_in: '입실 중',
  checked_out: '퇴실 완료',
  cancelled: '취소됨',
};

const statusFlow = {
  upcoming: ['checked_in', 'cancelled'],
  checked_in: ['checked_out', 'cancelled'],
  checked_out: [],
  cancelled: [],
};

function formatWon(amount) {
  return `₩${Number(amount).toLocaleString()}`;
}

function StatusBadge({ status, children }) {
  return <span className={`badge badge-${status}`} style={{ fontSize: 10 }}>{children}</span>;
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
          const nextStatuses = statusFlow[b.status] || [];
          return (
            <div key={b.id} className="mini-booking-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <strong style={{ fontSize: 13 }}>{b.guest_name}</strong>
                  <StatusBadge status={b.status}>
                    {statusLabels[b.status] || b.status}
                  </StatusBadge>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                {b.check_in} → {b.check_out}
                {b.amount ? ` · ${formatWon(b.amount)}` : ''}
              </div>
              {b.property_name && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>@{b.property_name}</div>
              )}

              {/* Quick status change buttons */}
              {nextStatuses.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  {nextStatuses.map(s => (
                    <button
                      key={s}
                      className={`btn btn-sm ${s === 'cancelled' ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => handleStatusChange(b.id, s)}
                      disabled={savingId === b.id}
                      style={{ fontSize: 10, padding: '2px 8px' }}
                    >
                      {savingId === b.id ? '...' : statusLabels[s]}
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
