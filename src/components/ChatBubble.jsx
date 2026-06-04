import React from 'react';

export default function ChatBubble({ role, children }) {
  const isUser = role === 'user';
  return (
    <div className={`chat-bubble chat-bubble--${role}`}>
      {!isUser && <span className="chat-avatar">🤖</span>}
      <div className="chat-bubble-content">{children}</div>
      {isUser && <span className="chat-avatar">👤</span>}
    </div>
  );
}
