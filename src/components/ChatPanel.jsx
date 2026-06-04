import React, { useState, useRef, useEffect } from 'react';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import UIRenderer from './UIRenderer';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: '안녕하세요! Warm Stay AI 어시스턴트입니다.\n\n다음과 같은 작업을 도와드릴 수 있어요:\n- 📋 예약 현황 조회 ("다음주 체크인 알려줘")\n- 📊 통계 확인 ("이번달 수익이 얼마야?")\n- 🏠 숙소 정보 확인 ("강남 스튜디오 예약 알려줘")',
};

export default function ChatPanel() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (text) => {
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.message, ui: data.ui || null },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '죄송합니다, 일시적인 오류가 발생했습니다. 다시 시도해주세요.',
          ui: null,
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={listRef}>
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role}>
            {msg.content.split('\n').map((line, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}{line}
              </React.Fragment>
            ))}
            {msg.ui && <UIRenderer ui={msg.ui} />}
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
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}
