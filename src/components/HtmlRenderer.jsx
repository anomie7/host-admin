import React, { useMemo, useRef, useEffect, useState } from 'react';

export default function HtmlRenderer({ content, style: cssText, height }) {
  const iframeRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  const htmlDoc = useMemo(() => {
    if (!content) return '';
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    color: var(--text-primary, #222);
    background: transparent;
    padding: 8px;
  }
  ${cssText || ''}
</style>
</head>
<body>${content}</body>
</html>`;
  }, [content, cssText]);

  useEffect(() => {
    if (!iframeRef.current) return;
    setLoaded(false);
    const iframe = iframeRef.current;
    iframe.src = 'about:blank';
    iframe.onload = () => {
      if (iframe.contentDocument) {
        iframe.contentDocument.open();
        iframe.contentDocument.write(htmlDoc);
        iframe.contentDocument.close();
        setLoaded(true);
      }
    };
    // Force reload
    iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlDoc);
  }, [htmlDoc]);

  if (!content) return null;

  return (
    <div className="mini-card" style={{ padding: 0, overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        title="HTML Renderer"
        sandbox="allow-scripts"
        style={{
          width: '100%',
          height: height || 200,
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  );
}
