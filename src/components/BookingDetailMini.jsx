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

export default function BookingDetailMini({ booking }) {
  if (!booking) return null;

  return (
    <div className="mini-card">
      <div className="mini-card-title">예약 상세</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>게스트</span>{' '}
          {booking.guest_name}
        </div>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>숙소</span>{' '}
          {booking.property_name || '-'}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>체크인</span>{' '}
            {booking.check_in}
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>체크아웃</span>{' '}
            {booking.check_out}
          </div>
        </div>
        {booking.amount > 0 && (
          <div>
            <span style={{ color: 'var(--text-dim)' }}>금액</span>{' '}
            {formatWon(booking.amount)}
          </div>
        )}
        <div>
          <span style={{ color: 'var(--text-dim)' }}>상태</span>{' '}
          <span className={`badge badge-${booking.status}`}>
            {statusLabels[booking.status] || booking.status}
          </span>
        </div>
      </div>
    </div>
  );
}
