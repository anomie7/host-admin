import React, { useState, useEffect, useCallback } from 'react';
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

function statusColor(status) {
  switch (status) {
    case 'checked_in': return '#10B981';
    case 'upcoming': return '#F59E0B';
    case 'checked_out': return '#3B82F6';
    case 'cancelled': return '#EF4444';
    default: return '#9CA3AF';
  }
}

function statusDot(status) {
  return {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: statusColor(status),
    marginRight: 2,
  };
}

function formatWon(amount) {
  return `₩${Number(amount).toLocaleString()}`;
}

// Simple hook — no re-render on resize, just reads once on mount
function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mobile;
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
  const isMobile = useIsMobile();

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

  const prevMonth = useCallback(() => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }, [month]);

  // Calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, other: true });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayBookings = calendarData[dateStr] || [];
    const isToday = dateStr === today.toISOString().slice(0, 10);
    cells.push({ day: i, dateStr, bookings: dayBookings, isToday });
  }
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
      const [cal, bks] = await Promise.all([
        api.getCalendar(month, year),
        api.getBookings({ month, year }),
      ]);
      setCalendarData(cal);
      setBookings(bks);
      setSelectedBooking(null);
      toast(`상태가 ${statusLabel(newStatus)}로 변경되었습니다`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // Mobile: cell is shorter, shows dots; Desktop: shows text snippets
  const cellMinH = isMobile ? 40 : 90;
  const dayFontSize = isMobile ? 11 : 12;
  const daySize = isMobile ? 20 : 24;
  const headerFontSize = isMobile ? 16 : 22;

  return (
    <div>
      {/* Month navigator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: isMobile ? 12 : 24,
      }}>
        <button className="btn btn-ghost" onClick={prevMonth} aria-label="이전 달" style={{ padding: isMobile ? 6 : 8 }}>
          <svg width={isMobile ? 14 : 16} height={isMobile ? 14 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: headerFontSize, fontWeight: 600, userSelect: 'none' }}>
          {isMobile ? `${year}.${String(month).padStart(2, '0')}` : `${MONTHS[month - 1]} ${year}`}
        </h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {!isMobile && (
            <button className="btn btn-secondary btn-sm" onClick={() => api.exportCsv(month, year)} title="CSV 내보내기" style={{ fontSize: 11 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: 'middle' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              CSV
            </button>
          )}
          <button className="btn btn-ghost" onClick={nextMonth} aria-label="다음 달" style={{ padding: isMobile ? 6 : 8 }}>
            <svg width={isMobile ? 14 : 16} height={isMobile ? 14 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
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
            gap: isMobile ? 1 : 1,
            background: 'var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
          }}>
            {/* Day headers */}
            {DAYS.map(d => (
              <div key={d} style={{
                background: 'var(--bg-secondary)',
                padding: isMobile ? '6px 2px' : '10px 8px',
                textAlign: 'center',
                fontSize: isMobile ? 10 : 12,
                color: 'var(--text-dim)',
                fontWeight: 500,
                letterSpacing: '0.3px',
              }}>{d}</div>
            ))}
            {/* Day cells */}
            {cells.map((cell, i) => {
              const hasBookings = cell.bookings?.length > 0;
              return (
                <div
                  key={i}
                  style={{
                    background: cell.isToday
                      ? 'var(--accent-glow)'
                      : cell.other ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                    padding: isMobile ? '2px' : '6px',
                    minHeight: cellMinH,
                    cursor: hasBookings ? 'pointer' : 'default',
                    opacity: cell.other ? 0.3 : 1,
                    transition: 'background 150ms ease',
                    position: 'relative',
                  }}
                  onClick={() => cell.dateStr && hasBookings && setSelectedDate(
                    selectedDate === cell.dateStr ? null : cell.dateStr
                  )}
                >
                  {/* Day number — top-left always */}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: daySize,
                    height: daySize,
                    borderRadius: '50%',
                    fontSize: dayFontSize,
                    fontWeight: cell.isToday ? 700 : 400,
                    background: cell.isToday ? 'var(--accent)' : 'transparent',
                    color: cell.isToday ? '#ffffff' : cell.other ? 'var(--text-dim)' : 'var(--text-secondary)',
                    marginBottom: isMobile ? 1 : 4,
                  }}>
                    {cell.day}
                  </span>

                  {/* Booking indicators */}
                  {isMobile ? (
                    /* Mobile: colored dots */
                    hasBookings && (
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', padding: '0 1px' }}>
                        {cell.bookings.slice(0, 4).map(b => (
                          <div key={b.id} style={{ ...statusDot(b.status), width: 5, height: 5, marginRight: 0 }} />
                        ))}
                        {cell.bookings.length > 4 && (
                          <span style={{ fontSize: 8, color: 'var(--text-dim)', lineHeight: '6px' }}>+{cell.bookings.length - 4}</span>
                        )}
                      </div>
                    )
                  ) : (
                    /* Desktop: text snippets */
                    <>
                      {cell.bookings?.slice(0, 3).map((b, j) => (
                        <div
                          key={b.id}
                          style={{
                            fontSize: 10,
                            padding: '1px 4px',
                            borderRadius: 3,
                            marginBottom: 1,
                            background: `${statusColor(b.status)}18`,
                            color: statusColor(b.status),
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            lineHeight: 1.6,
                          }}
                          onClick={(e) => { e.stopPropagation(); setSelectedBooking(b); }}
                          title={`${b.guest_name} - ${statusLabel(b.status)}`}
                        >
                          {b.property_name?.slice(0, isMobile ? 6 : 12)}
                        </div>
                      ))}
                      {cell.bookings?.length > 3 && (
                        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>+{cell.bookings.length - 3}</span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected date booking list — mobile bottom sheet */}
          {selectedDate && (calendarData[selectedDate]?.length > 0) && (
            <div style={{
              marginTop: 12,
              ...(isMobile ? {
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 90,
                maxHeight: '50vh',
                overflowY: 'auto',
                borderRadius: '16px 16px 0 0',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
                animation: 'slideUp 250ms ease',
              } : {}),
            }}>
              <div className="card" style={{
                padding: isMobile ? 16 : 20,
                margin: 0,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 14 : 16, fontWeight: 600 }}>
                    📅 {selectedDate} ({calendarData[selectedDate].length}건)
                  </h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDate(null)} style={{ fontSize: 12 }}>
                    {isMobile ? '닫기 ✕' : '닫기'}
                  </button>
                </div>
                {calendarData[selectedDate].map(b => (
                  <div
                    key={b.id}
                    className="card card-top"
                    style={{ marginBottom: 8, padding: isMobile ? 10 : 12, cursor: 'pointer' }}
                    onClick={() => setSelectedBooking(b)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: isMobile ? 13 : 14 }}>{b.guest_name}</strong>
                        <span style={{ color: 'var(--text-secondary)', fontSize: isMobile ? 11 : 12, marginLeft: 6 }}>@{b.property_name?.slice(0, isMobile ? 8 : 20)}</span>
                      </div>
                      <span className={`badge badge-${b.status}`} style={{ fontSize: isMobile ? 9 : 11 }}>{statusLabel(b.status)}</span>
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: isMobile ? 11 : 12, marginTop: 4 }}>
                      {b.check_in} → {b.check_out} · {platformLabels[b.platform] || b.platform} · {formatWon(b.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Booking Detail Modal */}
          {selectedBooking && (
            <div className="modal-overlay" onClick={() => setSelectedBooking(null)}>
              <div
                className="modal-content"
                onClick={e => e.stopPropagation()}
                style={{
                  ...(isMobile ? {
                    width: '100vw',
                    maxWidth: '100vw',
                    maxHeight: '80vh',
                    borderRadius: '20px 20px 0 0',
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    margin: 0,
                    padding: 24,
                    animation: 'slideUp 250ms ease',
                  } : {}),
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 17 : 18, fontWeight: 600, margin: 0 }}>
                    예약 상세
                  </h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedBooking(null)} style={{ fontSize: 13 }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12, marginBottom: 20 }}>
                  <div><span style={{ color: 'var(--text-dim)', fontSize: 12 }}>게스트</span><br /><strong>{selectedBooking.guest_name}</strong></div>
                  <div><span style={{ color: 'var(--text-dim)', fontSize: 12 }}>숙소</span><br />{selectedBooking.property_name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? 8 : 12 }}>
                    <div><span style={{ color: 'var(--text-dim)', fontSize: 12 }}>체크인</span><br />{selectedBooking.check_in}</div>
                    <div><span style={{ color: 'var(--text-dim)', fontSize: 12 }}>체크아웃</span><br />{selectedBooking.check_out}</div>
                  </div>
                  <div><span style={{ color: 'var(--text-dim)', fontSize: 12 }}>플랫폼</span><br />{platformLabels[selectedBooking.platform] || selectedBooking.platform}</div>
                  <div><span style={{ color: 'var(--text-dim)', fontSize: 12 }}>금액</span><br /><strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{formatWon(selectedBooking.amount)}</strong></div>
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
                {/* Status action buttons */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                  gap: isMobile ? 6 : 8,
                  marginBottom: 16,
                }}>
                  {['upcoming', 'checked_in', 'checked_out', 'cancelled'].map(s => (
                    <button
                      key={s}
                      className={`btn btn-sm ${selectedBooking.status === s ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleUpdateStatus(selectedBooking.id, s)}
                      disabled={selectedBooking.status === s}
                      style={{ fontSize: isMobile ? 11 : 12, padding: isMobile ? '6px 4px' : undefined }}
                    >
                      {statusLabel(s)}
                    </button>
                  ))}
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedBooking(null)}
                  style={{ width: '100%', padding: isMobile ? 10 : undefined }}
                >
                  닫기
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
