import React from 'react';

export default function TableWidget({ title, headers, rows }) {
  if (!headers || !rows || rows.length === 0) return null;

  return (
    <div className="mini-card" style={{ padding: 0, overflow: 'hidden' }}>
      {title && (
        <div style={{
          padding: '8px 14px',
          fontSize: 12,
          fontWeight: 600,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-light)',
          color: 'var(--text-primary)',
        }}>
          {title}
        </div>
      )}
      <div style={{ overflowX: 'auto', padding: 0 }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 11,
          fontFamily: 'var(--font-ui)',
        }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{
                  textAlign: 'left',
                  padding: '6px 10px',
                  color: 'var(--text-dim)',
                  fontWeight: 500,
                  borderBottom: '1px solid var(--border-light)',
                  background: 'var(--bg-primary)',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} style={{
                    padding: '6px 10px',
                    borderBottom: i < rows.length - 1 ? '1px solid var(--border-light)' : 'none',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                  }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
