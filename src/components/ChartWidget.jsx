import React from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = {
  airbnb: '#FF5A5F',
  booking: '#003580',
  liveanywhere: '#00A698',
  upcoming: '#3B82F6',
  checked_in: '#10B981',
  checked_out: '#6B7280',
  cancelled: '#EF4444',
};

const STATUS_LABELS = {
  upcoming: '입실 예정',
  checked_in: '입실 중',
  checked_out: '퇴실 완료',
  cancelled: '취소됨',
};

const PLATFORM_LABELS = {
  airbnb: '에어비앤비',
  booking: '부킹닷컴',
  liveanywhere: '리브애니웨어',
};

// Helper: normalize chart data to array format
function normalizeData(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    // {labels: [...], datasets: [{data: [...]}]} → transform
    if (data.labels && Array.isArray(data.labels)) {
      return data.labels.map((label, i) => ({
        label,
        value: data.datasets?.[0]?.data?.[i],
        ...(data.datasets?.[0]?.data?.[i] !== undefined ? { [data.datasets[0].key || 'value']: data.datasets[0].data[i] } : {}),
      }));
    }
    // {platforms: [...], revenues: [...], bookings: [...]} → merge
    if (data.platforms && Array.isArray(data.platforms)) {
      return data.platforms.map((p, i) => ({
        platform: p,
        revenue: data.revenues?.[i] || 0,
        bookings: data.bookings?.[i] || 0,
      }));
    }
    // {months: [...], revenue: [...], bookingCounts: [...]}
    if (data.months && Array.isArray(data.months)) {
      return data.months.map((m, i) => ({
        month: m,
        revenue: data.revenue?.[i] || 0,
        bookings: data.bookingCounts?.[i] || data.bookings?.[i] || 0,
      }));
    }
    // {properties: [{name, revenue, bookings}, ...]} — nested object
    if (data.properties && Array.isArray(data.properties)) {
      return data.properties;
    }
    // {labels: [...], ...series arrays} — generic labeled series format
    // e.g. {labels: ["1월","2월"], revenue: [100,200], booking_count: [5,6]}
    if (data.labels && Array.isArray(data.labels)) {
      // Find all numeric array properties
      const series = Object.entries(data).filter(([k, v]) =>
        k !== 'labels' && Array.isArray(v) && v.length === data.labels.length
      );
      if (series.length >= 1) {
        return data.labels.map((label, i) => {
          const obj = { label };
          series.forEach(([k, v]) => { obj[k] = v[i]; });
          return obj;
        });
      }
    }
    // {columns: [...], rows: [[...], ...]} — SQL result format
    if (data.columns && Array.isArray(data.columns) && data.rows && Array.isArray(data.rows)) {
      return data.rows.map(row => {
        const obj = {};
        data.columns.forEach((col, i) => { obj[col] = row[i]; });
        return obj;
      });
    }
    // Single object with numeric values → wrap in array
    const numericKeys = Object.entries(data).filter(([k, v]) => typeof v === 'number' && !k.startsWith('_'));
    if (numericKeys.length >= 2) {
      return [data];
    }
  }
  return [];
}

function formatWon(amount) {
  if (amount == null) return '₩0';
  if (amount >= 100000000) return `₩${(amount / 100000000).toFixed(1)}억`;
  if (amount >= 10000) return `₩${Math.round(amount / 10000).toLocaleString()}만`;
  return `₩${Number(amount).toLocaleString()}`;
}

// --- Revenue Line Chart ---
function RevenueChart({ data }) {
  const chartData = normalizeData(data).map(d => ({
    month: d.month 
      ? `${parseInt(d.month.toString().replace(/^\d{4}-/, '')).toString()}월`
      : (d.label || d.day || ''),
    revenue: d.revenue || d.daily_revenue || d.total_revenue || 0,
    bookings: d.bookings || d.booking_count || 0,
  }));
  if (chartData.length === 0) return <EmptyChart />;

  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={v => `${Math.round(v / 10000)}만`} />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'revenue') return [formatWon(value), '수익'];
              return [value, '예약'];
            }}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
          <Line type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Platform Revenue Bar Chart ---
function PlatformChart({ data }) {
  const chartData = normalizeData(data).map(d => ({
    platform: PLATFORM_LABELS[d.platform] || d.platform || d.label || d.name || '',
    revenue: d.revenue || d.total_revenue || 0,
    bookings: d.bookings || d.booking_count || 0,
  }));
  if (chartData.length === 0) return <EmptyChart />;

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
          <XAxis dataKey="platform" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={v => `${Math.round(v / 10000)}만`} />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'revenue') return [formatWon(value), '수익'];
              return [value, '예약'];
            }}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={Object.values(COLORS)[idx % Object.values(COLORS).length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Occupancy Bar Chart ---
function OccupancyChart({ data }) {
  const chartData = normalizeData(data).map(d => ({
    month: d.month ? `${String(d.month).replace(/^0/, '')}월` : (d.label || ''),
    rate: d.rate || d.occupancy_rate || 0,
    bookings: d.bookings || d.booking_count || 0,
  }));
  if (chartData.length === 0) return <EmptyChart />;

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={v => `${v}%`} />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'rate') return [`${value}%`, '점유율'];
              return [value, '예약'];
            }}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="rate" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Status Pie Chart ---
function StatusChart({ data }) {
  const chartData = normalizeData(data).map(d => ({
    name: STATUS_LABELS[d.status] || d.status || d.label || d.name || '',
    value: d.count || d.value || 0,
    status: d.status || d.label || '',
  }));
  if (chartData.length === 0) return <EmptyChart />;

  return (
    <div style={{ width: '100%', height: 200, display: 'flex', alignItems: 'center' }}>
      <ResponsiveContainer width="60%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell key={entry.status} fill={COLORS[entry.status] || '#999'} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [value, name]}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {chartData.map(entry => (
          <div key={entry.status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[entry.status] || '#999', display: 'inline-block' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
            <span style={{ fontWeight: 500 }}>{entry.value}건</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Summary Stats Card ---
function SummaryStats({ data }) {
  const d = Array.isArray(data) ? data[0] || {} : data;
  if (!d || Object.keys(d).length === 0) return <EmptyChart />;
  const items = [
    { label: '총 수익', value: formatWon(d.totalRevenue || d.total_revenue || d.revenue), color: 'var(--accent)' },
    { label: '총 예약', value: `${d.totalBookings || d.total_bookings || d.bookings || 0}건`, color: 'var(--secondary)' },
    { label: '평균 요금', value: formatWon(d.avgRate || d.avg_rate || d.average_rate), color: '#b07a28' },
    { label: '평균 점유율', value: `${d.occupancyRate || d.occupancy_rate || 0}%`, color: '#4a78a8' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {items.map(item => (
        <div key={item.label} style={{ textAlign: 'center', padding: '12px 8px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{item.label}</div>
          <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)', color: item.color }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Property Ranking Horizontal Bar Chart ---
function PropertyRanking({ data, sortBy }) {
  const chartData = normalizeData(data).filter(d => d.name || d.property_name);
  if (chartData.length === 0) return <EmptyChart />;
  const maxVal = Math.max(...chartData.map(d => sortBy === 'revenue' ? (d.total_revenue || d.revenue || 0) : (d.booking_count || d.bookings || 0)), 1);
  const barColor = sortBy === 'revenue' ? 'var(--accent)' : 'var(--secondary)';
  const formatVal = sortBy === 'revenue' ? v => formatWon(v) : v => `${v}건`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' }}>
      {chartData.map((d, i) => {
        const val = sortBy === 'revenue' ? (d.total_revenue || d.revenue || 0) : (d.booking_count || d.bookings || 0);
        const pct = (val / maxVal) * 100;
        return (
          <div key={d.property_id || i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                {i + 1}. {d.property_name?.slice(0, 12)}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: barColor, fontSize: 11 }}>
                {formatVal(val)}
              </span>
            </div>
            <div style={{ height: 14, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.max(pct, 4)}%`,
                background: `linear-gradient(90deg, ${barColor}, ${barColor}88)`,
                borderRadius: 4,
                transition: 'width 500ms ease',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyChart() {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
      차트 데이터가 없습니다
    </div>
  );
}

export default function ChartWidget({ chartType, title, data, sortBy }) {
  if (!chartType || !data) return <EmptyChart />;

  const renderChart = () => {
    switch (chartType) {
      case 'revenue':
        return <RevenueChart data={data} />;
      case 'platform':
        return <PlatformChart data={data} />;
      case 'occupancy':
        return <OccupancyChart data={data} />;
      case 'status':
        return <StatusChart data={data} />;
      case 'summary':
        return <SummaryStats data={data} />;
      case 'property-ranking':
        return <PropertyRanking data={data} sortBy={sortBy || 'revenue'} />;
      default:
        return <EmptyChart />;
    }
  };

  const chartLabels = {
    revenue: '📈 월별 수익',
    platform: '📊 플랫폼별 수익',
    occupancy: '📅 월별 점유율',
    status: '🔄 예약 상태',
    summary: '📋 종합 통계',
    'property-ranking': '🏠 숙소별 순위',
  };

  return (
    <div className="mini-card" style={{ padding: 16 }}>
      {title && <div className="mini-card-title">{title || chartLabels[chartType] || '차트'}</div>}
      {renderChart()}
    </div>
  );
}
