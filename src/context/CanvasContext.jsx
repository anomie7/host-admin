import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'canvas_items';

function loadCanvas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { items: [], title: '' };
  } catch { return { items: [], title: '' }; }
}

function saveCanvas(items, title) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, title })); } catch {}
}

const CanvasContext = createContext();

export function useCanvas() {
  return useContext(CanvasContext);
}

export function CanvasProvider({ children }) {
  const [items, setItems] = useState(() => loadCanvas().items);
  const [canvasTitle, setCanvasTitle] = useState(() => loadCanvas().title);

  useEffect(() => { saveCanvas(items, canvasTitle); }, [items, canvasTitle]);

  const addItem = useCallback((item) => {
    setItems(prev => [...prev, { ...item, id: item.id || `c${Date.now()}` }]);
  }, []);

  const addItems = useCallback((newItems) => {
    if (!newItems || newItems.length === 0) return;
    setItems(prev => {
      const existingIds = new Set(prev.map(i => i.id));
      const toAdd = newItems.filter(i => !existingIds.has(i.id));
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd];
    });
  }, []);

  const removeItem = useCallback((id) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const clearItems = useCallback(() => {
    setItems([]);
    setCanvasTitle('');
  }, []);

  const setTitle = useCallback((title) => {
    setCanvasTitle(title || '');
  }, []);

  return (
    <CanvasContext.Provider value={{ items, canvasTitle, addItem, addItems, removeItem, clearItems, setTitle }}>
      {children}
    </CanvasContext.Provider>
  );
}
