import React from 'react';

export default function TableWidget({ title, headers, rows }) {
  if (!headers || !rows || rows.length === 0) return null;

  const colCount = headers.length;
  // Responsive column widths: share space, min 60px
  const colWidth = Math.max(60, Math.floor(100 / colCount));

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
      <div style={{ overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
        <table style={{
          width: '100%',
          minWidth: colCount * 60,
          borderCollapse: 'collapse',
          fontSize: 11,
          fontFamily: 'var(--font-ui)',
          tableLayout: 'auto',
        }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  color: 'var(--text-dim)',
                  fontWeight: 500,
                  borderBottom: '1px solid var(--border-light)',
                  background: 'var(--bg-primary)',
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
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
                    padding: '6px 8px',
                    borderBottom: i < rows.length - 1 ? '1px solid var(--border-light)' : 'none',
                    color: 'var(--text-primary)',
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    wordBreak: 'keep-all',
                  }} title={typeof cell === 'string' && cell.length > 20 ? cell : undefined}>
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
