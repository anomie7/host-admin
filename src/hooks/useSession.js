import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY_SESSIONS = 'chat_sessions';
const STORAGE_KEY_CURRENT = 'chat_current_session';
const MSG_PREFIX = 'chat_messages_';

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function generateId() {
  return `s${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

function buildSession(title) {
  return { id: generateId(), title, createdAt: new Date().toISOString() };
}

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: '안녕하세요. Warm Stay AI 어시스턴트입니다.\n아래와 같이 물어보세요. (클릭도 됩니다!)',
  isWelcome: true,
  suggestions: [
    '이번달 총 수익이 얼마지?',
    '다음주 체크인 누구야?',
    '예약 제일 많은 숙소는?',
    '수익 1위 숙소 플랫폼별 실적',
    '월별 수익 추이 그래프로',
    '7월 예약 보여줘',
    '성수 플랫 예약을 플랫폼별로 나눠봐',
    '대쉬보드로 만들어봐',
    '예약 상태 변경해줘',
    '성수 미니멀 플랫에 🏆 라벨 붙여줘',
  ],
};

function getDefaultMessages() {
  return [WELCOME_MESSAGE];
}

function getDefaultTitle(messages) {
  // Find first user message to generate title
  const userMsg = messages.find(m => m.role === 'user');
  if (userMsg) {
    const txt = userMsg.content.trim();
    return txt.length > 28 ? txt.slice(0, 26) + '…' : txt;
  }
  return '새 대화';
}

export default function useSession() {
  const [sessions, setSessions] = useState(() => {
    const saved = loadJSON(STORAGE_KEY_SESSIONS, null);
    if (saved && saved.length > 0) return saved;
    // First visit — create a default session
    const defaultSession = buildSession('새 대화');
    saveJSON(`${MSG_PREFIX}${defaultSession.id}`, getDefaultMessages());
    saveJSON(STORAGE_KEY_CURRENT, defaultSession.id);
    return [defaultSession];
  });

  const [currentId, setCurrentId] = useState(() => {
    return loadJSON(STORAGE_KEY_CURRENT, sessions[0]?.id || null);
  });

  const [messages, setMessagesState] = useState(() => {
    const saved = currentId ? loadJSON(`${MSG_PREFIX}${currentId}`, null) : null;
    return saved || getDefaultMessages();
  });

  // Persist sessions list whenever it changes
  useEffect(() => { saveJSON(STORAGE_KEY_SESSIONS, sessions); }, [sessions]);

  // Persist current session id
  useEffect(() => { if (currentId) saveJSON(STORAGE_KEY_CURRENT, currentId); }, [currentId]);

  // Persist messages whenever they change
  useEffect(() => {
    if (currentId) saveJSON(`${MSG_PREFIX}${currentId}`, messages);
  }, [messages, currentId]);

  const currentSession = sessions.find(s => s.id === currentId) || sessions[0];

  // Switch to a different session
  const loadSession = useCallback((id) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    setCurrentId(id);
    const saved = loadJSON(`${MSG_PREFIX}${id}`, null);
    setMessagesState(saved || getDefaultMessages());
  }, [sessions]);

  // Create a new session
  const newSession = useCallback((title = '새 대화') => {
    const session = buildSession(title);
    setSessions(prev => [...prev, session]);
    setCurrentId(session.id);
    setMessagesState(getDefaultMessages());
    return session.id;
  }, []);

  // Delete a session
  const deleteSession = useCallback((id) => {
    const filtered = sessions.filter(s => s.id !== id);
    if (filtered.length === 0) {
      // Don't delete the last session — just reset it
      const defaultSession = buildSession('새 대화');
      saveJSON(`${MSG_PREFIX}${defaultSession.id}`, getDefaultMessages());
      setSessions([defaultSession]);
      setCurrentId(defaultSession.id);
      setMessagesState(getDefaultMessages());
      return;
    }
    setSessions(filtered);
    localStorage.removeItem(`${MSG_PREFIX}${id}`);
    if (currentId === id) {
      const next = filtered[0];
      setCurrentId(next.id);
      const saved = loadJSON(`${MSG_PREFIX}${next.id}`, null);
      setMessagesState(saved || getDefaultMessages());
    }
  }, [sessions, currentId]);

  // Update messages, with optional auto-title on first user message
  const setMessages = useCallback((newMessagesOrFn) => {
    setMessagesState(prev => {
      const next = typeof newMessagesOrFn === 'function' ? newMessagesOrFn(prev) : newMessagesOrFn;

      // Auto-title: when first user message appears, rename session
      const hadUser = prev.some(m => m.role === 'user');
      const hasUser = next.some(m => m.role === 'user');
      if (!hadUser && hasUser) {
        const title = getDefaultTitle(next);
        setSessions(s => s.map(ses =>
          ses.id === currentId ? { ...ses, title } : ses
        ));
      }

      return next;
    });
  }, [currentId]);

  // Rename a session
  const renameSession = useCallback((id, title) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s));
  }, []);

  return {
    sessions,
    currentSession,
    currentId,
    messages,
    setMessages,
    loadSession,
    newSession,
    deleteSession,
    renameSession,
  };
}
