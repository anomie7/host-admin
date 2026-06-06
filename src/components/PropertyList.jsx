import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from './Toast';

// Simple SVG icons for platforms
const platformLabels = {
  airbnb: '에어비앤비',
  booking: '부킹닷컴',
  liveanywhere: '리브애니웨어',
};

const PlatformIcon = ({ platform }) => {
  const icons = {
    airbnb: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>,
    booking: <svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    liveanywhere: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>,
  };
  return (
    <span style={{ width: 14, height: 14, opacity: 0.7 }} title={platform}>
      {icons[platform] || null}
    </span>
  );
};

export default function PropertyList() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const fetchProperties = useCallback(() => {
    api.getProperties()
      .then(setProperties)
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // Auto-refresh when returning to this page (tab focus / visibility change)
  useEffect(() => {
    window.addEventListener('focus', fetchProperties);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') fetchProperties();
    });
    return () => {
      window.removeEventListener('focus', fetchProperties);
      document.removeEventListener('visibilitychange', fetchProperties);
    };
  }, [fetchProperties]);

  // Listen for property data changes from AI (tags, status, etc.)
  useEffect(() => {
    const handleDataChanged = async () => {
      setRefreshing(true);
      // Small delay so the overlay is visible
      await new Promise(r => setTimeout(r, 600));
      try {
        const data = await api.getProperties();
        setProperties(data);
      } catch {}
      setRefreshing(false);
    };
    window.addEventListener('property-data-changed', handleDataChanged);
    return () => window.removeEventListener('property-data-changed', handleDataChanged);
  }, []);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this property?')) return;
    try {
      await api.deleteProperty(id);
      setProperties(prev => prev.filter(p => p.id !== id));
      toast('Property deleted', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="card" style={{ padding: 0, overflow: 'hidden', opacity: 0.5 }}>
            <div style={{ height: 160, background: 'var(--bg-elevated)' }} />
            <div style={{ padding: 16 }}><div style={{ height: 20, width: '60%', background: 'var(--bg-elevated)', borderRadius: 4, marginBottom: 8 }} /></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Refreshing overlay */}
      {refreshing && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(254, 249, 245, 0.75)',
          backdropFilter: 'blur(2px)',
          borderRadius: 'var(--radius)',
          animation: 'fadeIn 150ms ease',
        }}>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-light)',
            borderRadius: 16, padding: '24px 36px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏷️</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>라벨링 중...</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>변경사항을 반영하고 있습니다</div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          {properties.length} {properties.length === 1 ? 'property' : 'properties'}
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/properties/new')}>
          + 숙소 등록
        </button>
      </div>

      {properties.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--text-dim)', marginBottom: 12 }}>아직 등록된 숙소가 없습니다</p>
          <button className="btn btn-primary" onClick={() => navigate('/properties/new')}>
            첫 숙소 등록하기
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {properties.map(p => (
            <div
              key={p.id}
              className="card card-top"
              style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
              onClick={() => navigate(`/properties/${p.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && navigate(`/properties/${p.id}`)}
            >
              {/* Photo */}
              <div style={{ height: 160, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {p.photos && p.photos.length > 0 ? (
                  <img src={p.photos[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5">
                    <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                )}
              </div>
              {/* Body */}
              <div style={{ padding: 16, position: 'relative' }}>
                {/* Tags — top-right corner */}
                {p.tags && p.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                    {p.tags.map(tag => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 10,
                          background: tag.includes('🏆') ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 'var(--accent-glow)',
                          color: tag.includes('🏆') ? '#7c4a03' : 'var(--accent)',
                          fontWeight: 500, letterSpacing: '-0.3px',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{p.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12, lineClamp: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address}</p>
                {/* Platforms */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {(p.platforms || []).map(pl => (
                    <span key={pl} className="badge badge-upcoming" style={{ fontSize: 10 }}>
                      {platformLabels[pl] || pl}
                    </span>
                  ))}
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>#{p.id}</span>
                  <button className="btn btn-ghost btn-sm" onClick={e => handleDelete(e, p.id)} style={{ color: 'var(--danger)' }}>
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
