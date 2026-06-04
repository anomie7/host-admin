import React from 'react';

const statusLabels = {
  upcoming: '입실 예정',
  checked_in: '입실 중',
  checked_out: '퇴실 완료',
  cancelled: '취소됨',
};

function formatWon(amount) {
  return `₩${Number(amount).toLocaleString()}`;
}

export default function BookingListMini({ title, bookings }) {
  if (!bookings || bookings.length === 0) {
    return (
      <div className="mini-card">
        <p style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', padding: 12 }}>
          예약이 없습니다
        </p>
      </div>
    );
  }

  return (
    <div className="mini-card">
      {title && <div className="mini-card-title">{title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {bookings.map(b => (
          <div key={b.id} className="mini-booking-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 13 }}>{b.guest_name}</strong>
              <span className={`badge badge-${b.status}`} style={{ fontSize: 10 }}>
                {statusLabels[b.status] || b.status}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              {b.check_in} → {b.check_out}
              {b.amount ? ` · ${formatWon(b.amount)}` : ''}
            </div>
            {b.property_name && (
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>@{b.property_name}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
