import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useToast } from './Toast';

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월'];
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function statusLabel(status) {
  const labels = {
    upcoming: '입실 예정',
    checked_in: '입실 중',
    checked_out: '퇴실 완료',
    cancelled: '취소됨',
  };
  return labels[status] || status;
}

const platformLabels = {
  airbnb: '에어비앤비',
  booking: '부킹닷컴',
  liveanywhere: '리브애니웨어',
};

function statusIcon(status) {
  const icons = {
    checked_in: '🟢',
    upcoming: '🟡',
    checked_out: '🔵',
    cancelled: '⚪',
  };
  return icons[status] || '⚪';
}

function statusColor(status) {
  switch (status) {
    case 'checked_in': return 'var(--success)';
    case 'upcoming': return 'var(--warning)';
    case 'checked_out': return 'var(--info)';
    case 'cancelled': return 'var(--danger)';
    default: return 'var(--text-dim)';
  }
}

function formatWon(amount) {
  return `₩${amount.toLocaleString()}`;
}

export default function CalendarView() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [calendarData, setCalendarData] = useState({});
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getCalendar(month, year),
      api.getBookings({ month, year }),
    ])
      .then(([cal, bks]) => {
        setCalendarData(cal);
        setBookings(bks);
      })
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [month, year]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const cells = [];
  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, other: true });
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayBookings = calendarData[dateStr] || [];
    const isToday = dateStr === today.toISOString().slice(0, 10);
    cells.push({ day: i, dateStr, bookings: dayBookings, isToday });
  }
  // Next month padding
  const remaining = 7 - (cells.length % 7 || 7);
  for (let i = 1; i <= remaining && remaining < 7; i++) {
    cells.push({ day: i, other: true });
  }

  const weekRows = [];
  for (let i = 0; i < cells.length; i += 7) {
    weekRows.push(cells.slice(i, i + 7));
  }

  const handleUpdateStatus = async (bookingId, newStatus) => {
    try {
      await api.updateBooking(bookingId, { status: newStatus });
      // Refresh
      const [cal, bks] = await Promise.all([
        api.getCalendar(month, year),
        api.getBookings({ month, year }),
      ]);
      setCalendarData(cal);
      setBookings(bks);
      setSelectedBooking(null);
      toast(`상태가 ${newStatus}로 변경되었습니다`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      {/* Month navigator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={prevMonth} aria-label="이전 달">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600 }}>
          {MONTHS[month - 1]} {year}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => api.exportCsv(month, year)} title="CSV 내보내기">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            CSV
          </button>
          <button className="btn btn-ghost" onClick={nextMonth} aria-label="다음 달">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>캘린더 로딩 중...</p>
      ) : (
        <>
          {/* Calendar Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 1,
            background: 'var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
          }}>
            {/* Day headers */}
            {DAYS.map(d => (
              <div key={d} style={{
                background: 'var(--bg-secondary)',
                padding: '10px 8px',
                textAlign: 'center',
                fontSize: 12,
                color: 'var(--text-dim)',
                fontWeight: 500,
                letterSpacing: '0.5px',
              }}>{d}</div>
            ))}
            {/* Day cells */}
            {cells.map((cell, i) => (
              <div
                key={i}
                style={{
                  background: cell.isToday ? 'var(--accent-glow)' : 'var(--bg-primary)',
                  padding: '6px',
                  minHeight: 90,
                  cursor: cell.bookings?.length ? 'pointer' : 'default',
                  opacity: cell.other ? 0.3 : 1,
                  transition: 'background 150ms ease',
                }}
                onClick={() => cell.dateStr && setSelectedDate(cell.dateStr)}
              >
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  fontSize: 12,
                  fontWeight: cell.isToday ? 700 : 400,
                  background: cell.isToday ? 'var(--accent)' : 'transparent',
                  color: cell.isToday ? '#ffffff' : 'var(--text-secondary)',
                  marginBottom: 4,
                }}>
                  {cell.day}
                </span>
                {cell.bookings?.slice(0, 3).map((b, j) => (
                  <div
                    key={b.id}
                    style={{
                      fontSize: 10,
                      padding: '2px 4px',
                      borderRadius: 3,
                      marginBottom: 2,
                      background: `${statusColor(b.status)}22`,
                      color: statusColor(b.status),
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelectedBooking(b); }}
                    title={`${b.guest_name} - ${statusLabel(b.status)}`}
                  >
                    {b.property_name?.slice(0, 12)} {statusIcon(b.status)}
                  </div>
                ))}
                {cell.bookings?.length > 3 && (
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>외 {cell.bookings.length - 3}건</span>
                )}
              </div>
            ))}
          </div>

          {/* Booking list for selected date */}
          {selectedDate && (calendarData[selectedDate]?.length > 0) && (
            <div className="card" style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>
                  {selectedDate} 예약 내역
                </h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDate(null)}>닫기</button>
              </div>
              {calendarData[selectedDate].map(b => (
                <div
                  key={b.id}
                  className="card card-top"
                  style={{ marginBottom: 8, padding: 12, cursor: 'pointer' }}
                  onClick={() => setSelectedBooking(b)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>{b.guest_name}</strong>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12, marginLeft: 8 }}>@{b.property_name}</span>
                    </div>
                    <span className={`badge badge-${b.status}`}>{statusLabel(b.status)}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 4 }}>
                    {b.check_in} → {b.check_out} · {platformLabels[b.platform] || b.platform} · {formatWon(b.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Booking Detail Modal */}
          {selectedBooking && (
            <div className="modal-overlay" onClick={() => setSelectedBooking(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>예약 상세</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  <div><span style={{ color: 'var(--text-dim)', fontSize: 12 }}>게스트</span><br /><strong>{selectedBooking.guest_name}</strong></div>
                  <div><span style={{ color: 'var(--text-dim)', fontSize: 12 }}>숙소</span><br />{selectedBooking.property_name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><span style={{ color: 'var(--text-dim)', fontSize: 12 }}>체크인</span><br />{selectedBooking.check_in}</div>
                    <div><span style={{ color: 'var(--text-dim)', fontSize: 12 }}>체크아웃</span><br />{selectedBooking.check_out}</div>
                  </div>
                  <div><span style={{ color: 'var(--text-dim)', fontSize: 12 }}>플랫폼</span><br />{platformLabels[selectedBooking.platform] || selectedBooking.platform}</div>
                  <div><span style={{ color: 'var(--text-dim)', fontSize: 12 }}>금액</span><br />{formatWon(selectedBooking.amount)}</div>
                  {selectedBooking.settlement_date && (
                    <div><span style={{ color: 'var(--text-dim)', fontSize: 12 }}>정산 예정일</span><br />{selectedBooking.settlement_date}</div>
                  )}
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>상태</span><br />
                    <span className={`badge badge-${selectedBooking.status}`} style={{ marginTop: 4 }}>
                      {statusLabel(selectedBooking.status)}
                    </span>
                  </div>
                  {selectedBooking.notes && (
                    <div><span style={{ color: 'var(--text-dim)', fontSize: 12 }}>메모</span><br />{selectedBooking.notes}</div>
                  )}
                </div>
                {/* Status actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  {['upcoming', 'checked_in', 'checked_out', 'cancelled'].map(s => (
                    <button
                      key={s}
                      className={`btn btn-sm ${selectedBooking.status === s ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleUpdateStatus(selectedBooking.id, s)}
                      disabled={selectedBooking.status === s}
                    >
                      {statusLabel(s)}
                    </button>
                  ))}
                </div>
                <button className="btn btn-secondary" onClick={() => setSelectedBooking(null)} style={{ width: '100%' }}>닫기</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
