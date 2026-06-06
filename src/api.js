const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Properties
  getProperties: () => request('/properties'),
  getProperty: (id) => request(`/properties/${id}`),
  createProperty: (data) => request('/properties', { method: 'POST', body: JSON.stringify(data) }),
  updateProperty: (id, data) => request(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProperty: (id) => request(`/properties/${id}`, { method: 'DELETE' }),
  uploadPhotos: (id, files) => {
    const formData = new FormData();
    files.forEach(f => formData.append('photos', f));
    return fetch(`${BASE}/properties/${id}/photos`, { method: 'POST', body: formData }).then(r => r.json());
  },
  deletePhoto: (id, photo) => request(`/properties/${id}/photos`, { method: 'DELETE', body: JSON.stringify({ photo }) }),

  // Tags
  addTag: (id, tag) => request(`/properties/${id}/tags`, { method: 'POST', body: JSON.stringify({ tag }) }),
  removeTag: (id, tag) => request(`/properties/${id}/tags`, { method: 'DELETE', body: JSON.stringify({ tag }) }),

  // Bookings
  getBookings: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/bookings${qs ? `?${qs}` : ''}`);
  },
  getBooking: (id) => request(`/bookings/${id}`),
  createBooking: (data) => request('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateBooking: (id, data) => request(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBooking: (id) => request(`/bookings/${id}`, { method: 'DELETE' }),

  // Calendar
  getCalendar: (month, year) => request(`/calendar?month=${month}&year=${year}`),

  // Dashboard
  getDashboardSummary: () => request('/dashboard/summary'),

  // CSV Export
  getExportUrl: (month, year) => {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (year) params.set('year', year);
    return `${BASE}/bookings/export/csv?${params.toString()}`;
  },
  exportCsv: (month, year) => {
    window.open(api.getExportUrl(month, year), '_blank');
  },
};
