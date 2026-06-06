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

export default function BookingDetailMini({ booking: initialBooking, onStatusChange }) {
  const [booking, setBooking] = useState(initialBooking);
  const [saving, setSaving] = useState(false);

  if (!booking) return null;

  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      const updated = await api.updateBooking(booking.id, { status: newStatus });
      setBooking(prev => ({ ...prev, status: updated.status }));
      if (onStatusChange) onStatusChange(booking.id, newStatus);
    } catch (err) {
      alert('상태 변경 실패: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const nextStatuses = statusFlow[booking.status] || [];

  return (
    <div className="mini-card">
      <div className="mini-card-title">예약 상세</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>게스트</span>{' '}
          <strong>{booking.guest_name}</strong>
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
            <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{formatWon(booking.amount)}</strong>
          </div>
        )}
        <div>
          <span style={{ color: 'var(--text-dim)' }}>상태</span>{' '}
          <span className={`badge badge-${booking.status}`}>
            {statusLabels[booking.status] || booking.status}
          </span>
        </div>

        {/* Status change buttons */}
        {nextStatuses.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {nextStatuses.map(s => (
              <button
                key={s}
                className={`btn btn-sm ${s === 'cancelled' ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => handleStatusChange(s)}
                disabled={saving}
                style={{ fontSize: 11, padding: '4px 10px' }}
              >
                {saving ? '...' : statusLabels[s]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
