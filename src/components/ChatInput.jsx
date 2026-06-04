import React, { useState } from 'react';

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="chat-input-form" onSubmit={handleSubmit}>
      <textarea
        className="chat-input"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="메시지를 입력하세요..."
        rows={1}
        disabled={disabled}
      />
      <button type="submit" className="chat-send-btn" disabled={!text.trim() || disabled} aria-label="전송">
        ➤
      </button>
    </form>
  );
}
