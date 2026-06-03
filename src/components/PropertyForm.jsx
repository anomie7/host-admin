import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useToast } from './Toast';

const PLATFORMS = [
  { id: 'airbnb', label: '에어비앤비' },
  { id: 'booking', label: '부킹닷컴' },
  { id: 'liveanywhere', label: '리브애니웨어' },
];

export default function PropertyForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({ name: '', address: '', description: '', platforms: [] });
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      api.getProperty(id)
        .then(p => {
          setForm({ name: p.name, address: p.address, description: p.description, platforms: p.platforms || [] });
          setPhotos(p.photos || []);
        })
        .catch(e => toast(e.message, 'error'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const togglePlatform = (platformId) => {
    setForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platformId)
        ? prev.platforms.filter(p => p !== platformId)
        : [...prev.platforms, platformId],
    }));
  };

  const handlePhotoUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    if (!isEdit) {
      toast('숙소를 먼저 저장한 후 사진을 추가해주세요', 'info');
      return;
    }
    try {
      const result = await api.uploadPhotos(id, Array.from(files));
      setPhotos(result.photos);
      toast('사진이 업로드되었습니다', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeletePhoto = async (photo) => {
    try {
      const result = await api.deletePhoto(id, photo);
      setPhotos(result.photos);
      toast('사진이 삭제되었습니다', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      toast('숙소명과 주소는 필수입니다', 'error');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.updateProperty(id, form);
        toast('숙소가 수정되었습니다', 'success');
      } else {
        const created = await api.createProperty(form);
        toast('숙소가 등록되었습니다', 'success');
        navigate(`/properties/${created.id}`, { replace: true });
        return;
      }
      navigate('/properties');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-dim)' }}>로딩 중...</p>;

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? '저장 중...' : isEdit ? '숙소 수정' : '숙소 등록'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/properties')}>
          취소
        </button>
      </div>

      {/* Basic Info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
        <div className="form-group">
          <label htmlFor="name">숙소명</label>
          <input id="name" name="name" className="form-input" value={form.name} onChange={handleChange} placeholder="예: 코지 강남 스튜디오" autoComplete="off" />
        </div>
        <div className="form-group">
          <label htmlFor="address">주소</label>
          <input id="address" name="address" className="form-input" value={form.address} onChange={handleChange} placeholder="전체 주소를 입력하세요" autoComplete="off" />
        </div>
        <div className="form-group">
          <label htmlFor="description">설명</label>
          <textarea id="description" name="description" className="form-input" value={form.description} onChange={handleChange} placeholder="선택 사항: 숙소 설명을 입력하세요..." />
        </div>
      </div>

      {/* Platforms */}
      <div style={{ marginBottom: 32 }}>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 8 }}>등록 플랫폼</label>
        <div className="platform-toggles">
          {PLATFORMS.map(p => (
            <button key={p.id} type="button" className={`platform-btn ${form.platforms.includes(p.id) ? 'active' : ''}`} onClick={() => togglePlatform(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Photos */}
      <div style={{ marginBottom: 32 }}>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 8 }}>사진</label>
        {photos.length > 0 && (
          <div className="photo-grid" style={{ marginBottom: 12 }}>
            {photos.map((ph, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={ph} alt={`Photo ${i + 1}`} className="photo-thumb" />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '2px 6px', fontSize: 11 }}
                  onClick={() => handleDeletePhoto(ph)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="photo-upload-area" onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}>
          <p style={{ fontSize: 13 }}>{isEdit ? '클릭하여 사진 업로드' : '숙소를 먼저 저장한 후 사진을 추가할 수 있습니다'}</p>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
      </div>
    </form>
  );
}
