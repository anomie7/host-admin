import React, { createContext, useContext, useState, useCallback } from 'react';

const CanvasContext = createContext();

export function useCanvas() {
  return useContext(CanvasContext);
}

export function CanvasProvider({ children }) {
  const [items, setItems] = useState([]);
  const [canvasTitle, setCanvasTitle] = useState('');

  const addItem = useCallback((item) => {
    // item: { type, props, id }
    setItems(prev => [...prev, { ...item, id: item.id || `c${Date.now()}` }]);
  }, []);

  const addItems = useCallback((newItems) => {
    if (!newItems || newItems.length === 0) return;
    setItems(prev => {
      const existingIds = new Set(prev.map(i => i.id));
      const toAdd = newItems.filter(i => !existingIds.has(i.id));
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
