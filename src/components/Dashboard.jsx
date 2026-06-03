import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useToast } from './Toast';

function formatWon(amount) {
  return `₩${Number(amount).toLocaleString()}`;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api.getDashboardSummary()
      .then(setData)
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="card" style={{ height: 100, opacity: 0.4 }}>
            <div style={{ height: 16, width: '50%', background: 'var(--border)', borderRadius: 4, marginBottom: 12 }} />
            <div style={{ height: 28, width: '30%', background: 'var(--border)', borderRadius: 4 }} />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { today, month, settlements, platformRevenue, recentBookings } = data;

  return (
    <div>
      {/* ===== 알림 배너 (Feature 4) ===== */}
      {(today.checkIns > 0 || today.checkOuts > 0) && (
        <div style={{
          background: 'linear-gradient(135deg, var(--accent-glow), rgba(10,138,122,0.06))',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 20 }}>📋</span>
          <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
            오늘의 일정
          </span>
          {today.checkIns > 0 && (
            <span style={{
              background: 'rgba(10,138,122,0.12)',
              color: 'var(--secondary-dim)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              fontSize: 13,
              fontWeight: 500,
            }}>
              체크인 {today.checkIns}건
            </span>
          )}
          {today.checkOuts > 0 && (
            <span style={{
              background: 'rgba(212,151,63,0.12)',
              color: '#b07a28',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              fontSize: 13,
              fontWeight: 500,
            }}>
              체크아웃 {today.checkOuts}건
            </span>
          )}
          {settlements.count > 0 && (
            <span style={{
              background: 'rgba(91,143,196,0.12)',
              color: '#4a78a8',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              fontSize: 13,
              fontWeight: 500,
            }}>
              정산 예정 {settlements.count}건 ({formatWon(settlements.total)})
            </span>
          )}
          {today.checkIns === 0 && today.checkOuts === 0 && settlements.count === 0 && (
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>오늘은 예약 일정이 없습니다</span>
          )}
        </div>
      )}

      {/* ===== 통계 카드 (Feature 1) ===== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <div className="card card-top" style={{ padding: 20 }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500, letterSpacing: '0.3px' }}>이번달 수익</span>
          <div style={{ fontSize: 26, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginTop: 4 }}>
            {formatWon(month.totalRevenue)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {month.totalBookings}개 예약 · 평균 {formatWon(month.avgRate)}
          </div>
        </div>
        <div className="card card-top" style={{ padding: 20, borderTopColor: 'var(--secondary)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500, letterSpacing: '0.3px' }}>점유율</span>
          <div style={{ fontSize: 26, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--secondary)', marginTop: 4 }}>
            {month.occupancyRate}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            이번달 예약 {month.totalBookings}건
          </div>
        </div>
        <div className="card card-top" style={{ padding: 20, borderTopColor: 'var(--warning)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500, letterSpacing: '0.3px' }}>오늘 체크인</span>
          <div style={{ fontSize: 26, fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#b07a28', marginTop: 4 }}>
            {today.checkIns}건
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {today.checkInRevenue > 0 ? formatWon(today.checkInRevenue) : '예정된 입실 없음'}
          </div>
        </div>
        <div className="card card-top" style={{ padding: 20, borderTopColor: 'var(--info)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500, letterSpacing: '0.3px' }}>정산 예정</span>
          <div style={{ fontSize: 26, fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#4a78a8', marginTop: 4 }}>
            {settlements.count}건
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {settlements.total > 0 ? formatWon(settlements.total) : '이번달 정산 없음'}
          </div>
        </div>
      </div>

      {/* ===== 하단: 최근 예약 + 플랫폼별 수익 ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 최근 예약 */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            최근 예약
          </h3>
          {recentBookings.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>최근 예약이 없습니다</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentBookings.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{b.guest_name}</span>
                    <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>@{b.property_name?.slice(0, 10)}</span>
                  </div>
                  <span className={`badge badge-${b.status}`} style={{ fontSize: 10 }}>
                    {b.status_label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 플랫폼별 수익 */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            플랫폼별 수익
          </h3>
          {platformRevenue.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>이번달 예약 데이터가 없습니다</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {platformRevenue.map(p => {
                const maxRevenue = Math.max(...platformRevenue.map(x => x.revenue), 1);
                const pct = (p.revenue / maxRevenue) * 100;
                const platformLabel = { airbnb: '에어비앤비', booking: '부킹닷컴', liveanywhere: '리브애니웨어' };
                return (
                  <div key={p.platform}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{platformLabel[p.platform] || p.platform}</span>
                      <span style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{formatWon(p.revenue)}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: p.platform === 'airbnb' ? 'var(--accent)' : p.platform === 'booking' ? 'var(--secondary)' : 'var(--warning)',
                        borderRadius: 3,
                        transition: 'width 500ms ease',
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{p.bookings}개 예약</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
