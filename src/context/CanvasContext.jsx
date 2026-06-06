import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY_SESSIONS = 'canvas_sessions';
const STORAGE_KEY_CURRENT = 'canvas_current_session';
const ITEMS_PREFIX = 'canvas_items_';

function loadJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function generateId() {
  return `cs${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

function buildSession(title) {
  return { id: generateId(), title, createdAt: new Date().toISOString() };
}

const CanvasContext = createContext();

export function useCanvas() {
  return useContext(CanvasContext);
}

export function CanvasProvider({ children }) {
  const [sessions, setSessions] = useState(() => {
    return loadJSON(STORAGE_KEY_SESSIONS, []);
  });
  const [currentId, setCurrentId] = useState(() => {
    return loadJSON(STORAGE_KEY_CURRENT, null);
  });
  const [items, setItemsState] = useState(() => {
    const id = loadJSON(STORAGE_KEY_CURRENT, null);
    return id ? loadJSON(`${ITEMS_PREFIX}${id}`, []) : [];
  });
  const [canvasTitle, setCanvasTitleState] = useState(() => {
    const id = loadJSON(STORAGE_KEY_CURRENT, null);
    if (!id) return '';
    const sessions = loadJSON(STORAGE_KEY_SESSIONS, []);
    const session = sessions.find(s => s.id === id);
    return session?.title || '';
  });

  // Persist
  useEffect(() => { saveJSON(STORAGE_KEY_SESSIONS, sessions); }, [sessions]);
  useEffect(() => { if (currentId) saveJSON(STORAGE_KEY_CURRENT, currentId); }, [currentId]);
  useEffect(() => { if (currentId) saveJSON(`${ITEMS_PREFIX}${currentId}`, items); }, [items, currentId]);

  const currentSession = sessions.find(s => s.id === currentId) || null;

  // Load a specific canvas session
  const loadSession = useCallback((id) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    setCurrentId(id);
    const saved = loadJSON(`${ITEMS_PREFIX}${id}`, []);
    setItemsState(saved);
    setCanvasTitleState(session.title);
  }, [sessions]);

  // Create a new canvas session (always creates new — never overwrites)
  const createSession = useCallback((title, newItems) => {
    const session = buildSession(title || '대시보드');
    const itemsWithIds = (newItems || []).map((item, i) => ({
      ...item,
      id: item.id || `c${i}`,
    }));
    saveJSON(`${ITEMS_PREFIX}${session.id}`, itemsWithIds);
    setSessions(prev => [...prev, session]);
    setCurrentId(session.id);
    setItemsState(itemsWithIds);
    setCanvasTitleState(session.title);
    return session.id;
  }, []);

  // Delete a canvas session
  const deleteSession = useCallback((id) => {
    const filtered = sessions.filter(s => s.id !== id);
    localStorage.removeItem(`${ITEMS_PREFIX}${id}`);
    if (filtered.length === 0) {
      setSessions([]);
      setCurrentId(null);
      setItemsState([]);
      setCanvasTitleState('');
      return;
    }
    setSessions(filtered);
    if (currentId === id) {
      const next = filtered[0];
      setCurrentId(next.id);
      const saved = loadJSON(`${ITEMS_PREFIX}${next.id}`, []);
      setItemsState(saved);
      setCanvasTitleState(next.title);
    }
  }, [sessions, currentId]);

  // Rename current session
  const renameSession = useCallback((id, title) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s));
    if (currentId === id) setCanvasTitleState(title);
  }, [currentId]);

  // Add items to current session (used for manual add-to-canvas from chat)
  const addItem = useCallback((item) => {
    setItemsState(prev => {
      const exists = prev.some(i => i.id === item.id);
      if (exists) return prev;
      return [...prev, { ...item, id: item.id || `c${Date.now()}` }];
    });
  }, []);

  const addItems = useCallback((newItems) => {
    if (!newItems || newItems.length === 0) return;
    setItemsState(prev => {
      const existingIds = new Set(prev.map(i => i.id));
      const toAdd = newItems.filter(i => !existingIds.has(i.id));
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd];
    });
  }, []);

  const removeItem = useCallback((id) => {
    setItemsState(prev => prev.filter(i => i.id !== id));
  }, []);

  // Clear all items from current session (but keep the session itself)
  const clearItems = useCallback(() => {
    if (!currentId) return;
    setItemsState([]);
    saveJSON(`${ITEMS_PREFIX}${currentId}`, []);
  }, [currentId]);

  const setTitle = useCallback((title) => {
    if (!currentId) return;
    setCanvasTitleState(title || '');
    setSessions(prev => prev.map(s => s.id === currentId ? { ...s, title: title || s.title } : s));
  }, [currentId]);

  return (
    <CanvasContext.Provider value={{
      sessions,
      currentSession,
      currentId,
      items,
      canvasTitle,
      addItem,
      addItems,
      removeItem,
      clearItems,
      setTitle,
      loadSession,
      createSession,
      deleteSession,
      renameSession,
    }}>
      {children}
    </CanvasContext.Provider>
  );
}
