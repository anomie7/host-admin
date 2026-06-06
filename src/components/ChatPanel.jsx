import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanvas } from '../context/CanvasContext';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import UIRenderer from './UIRenderer';
import useSession from '../hooks/useSession';

export default function ChatPanel() {
  const { messages, setMessages, sessions, currentSession, currentId, loadSession, newSession, deleteSession } = useSession();
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const listRef = useRef(null);
  const canvas = useCanvas();
  const navigate = useNavigate();

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (text) => {
    if (!text.trim()) return;
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Include UI data summaries in the message history so AI can reference past queries
      const messagesForApi = [...messages, userMsg].map(m => {
        let content = m.content;
        // If assistant message has UI data (stats, bookings), append summary for context
        if (m.role === 'assistant' && m.ui) {
          const uiData = m.ui;
          if (uiData.type === 'stats-card') {
            content += `\n[DATA: ${uiData.props?.label || '통계'} = ${uiData.props?.value || ''}]`;
          } else if (uiData.type === 'booking-list' && uiData.props?.bookings) {
            const bks = uiData.props.bookings;
            const summary = bks.slice(0, 2).map(b => `${b.guest_name}(${b.property_name?.slice(0,6)||''})`).join(', ');
            content += `\n[DATA: 예약 ${bks.length}건 — ${summary}${bks.length > 2 ? ` 외 ${bks.length - 2}건` : ''}]`;
          } else if (uiData.type === 'booking-detail' && uiData.props?.booking) {
            const b = uiData.props.booking;
            content += `\n[DATA: 예약 #${b.id} — ${b.guest_name} @ ${b.property_name?.slice(0,10)||''} ${b.check_in||''}~${b.check_out||''} ${b.amount ? '₩'+Number(b.amount).toLocaleString() : ''}]`;
          } else if (uiData.type === 'chart') {
            content += `\n[DATA: ${uiData.props?.chartType || ''} 차트]`;
          } else if (uiData.type === 'property-card') {
            content += `\n[DATA: 숙소 — ${uiData.props?.name || ''}]`;
          }
        }
        // Also note if canvas was added
        if (m.canvasAdded) {
          content += '\n[DATA: 캔버스에 대시보드 추가됨]';
        }
        return { role: m.role, content };
      });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesForApi,
        }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      const assistantMsg = { role: 'assistant', content: data.message, ui: data.ui || null };

      // If AI returned canvas payload, create a NEW canvas session (never overwrites)
      if (data.canvas && data.canvas.items && data.canvas.items.length > 0) {
        const title = data.canvas.title || '대시보드';
        canvas.createSession(title, data.canvas.items);
        assistantMsg.canvasAdded = true;
        setTimeout(() => { navigate('/canvas'); }, 500);
      }

      // If AI modified data (tags, booking status), broadcast refresh event
      if (data._refetch === 'properties') {
        window.dispatchEvent(new CustomEvent('property-data-changed'));
      }

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg = err.message === 'API error'
        ? 'AI 응답을 처리하는 중 오류가 발생했습니다. 다시 시도해주세요.'
        : '네트워크 오류가 발생했습니다. 연결을 확인해주세요.';
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: errMsg,
          ui: null,
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const sessionMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(e.target)) {
        setShowSessionMenu(false);
      }
    };
    if (showSessionMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSessionMenu]);

  const handleDeleteSession = (id, e) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      newSession();
      return;
    }
    if (window.confirm('이 대화를 삭제할까요?')) {
      deleteSession(id);
    }
  };

  const handleAddToCanvas = (item) => {
    canvas.addItem(item);
    navigate('/canvas');
  };

  const handleSuggestionClick = (suggestion) => {
    setInputText(suggestion);
    // Small delay so user sees the text fill before it sends
    setTimeout(() => {
      handleSend(suggestion);
      setInputText('');
    }, 100);
  };

  return (
    <div className="chat-panel">
      {/* Session bar */}
      <div className="chat-session-bar" ref={sessionMenuRef}>
        <button
          className="chat-session-toggle"
          onClick={() => setShowSessionMenu(prev => !prev)}
          title="대화 전환"
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
            💬 {currentSession?.title || '대화'}
          </span>
          <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}>▼</span>
        </button>
        <button
          className="chat-session-new"
          onClick={() => newSession()}
          title="새 대화"
        >
          ✚
        </button>

        {showSessionMenu && (
          <div className="chat-session-dropdown">
            {sessions.map(s => (
              <div
                key={s.id}
                className={`chat-session-item ${s.id === currentId ? 'chat-session-item--active' : ''}`}
                onClick={() => { loadSession(s.id); setShowSessionMenu(false); }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {s.title}
                </span>
                <button
                  className="chat-session-del"
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  title="삭제"
                >✕</button>
              </div>
            ))}
            <div
              className="chat-session-item chat-session-item--new"
              onClick={() => { newSession(); setShowSessionMenu(false); }}
            >
              ✚ 새 대화
            </div>
          </div>
        )}
      </div>

      <div className="chat-messages" ref={listRef}>
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role}>
            {msg.content.split('\n').map((line, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}{line}
              </React.Fragment>
            ))}
            {msg.ui && (
              <UIRenderer ui={msg.ui} onAddToCanvas={handleAddToCanvas} />
            )}
            {msg.isWelcome && msg.suggestions && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                {msg.suggestions.map((s, j) => (
                  <button
                    key={j}
                    className="chat-suggestion-btn"
                    onClick={() => handleSuggestionClick(s)}
                    disabled={loading}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </ChatBubble>
        ))}
        {loading && (
          <ChatBubble role="assistant">
            <span className="typing-indicator">
              <span>.</span><span>.</span><span>.</span>
            </span>
          </ChatBubble>
        )}
      </div>
      <ChatInput
        text={inputText}
        onTextChange={setInputText}
        onSend={handleSend}
        disabled={loading}
      />
    </div>
  );
}
