import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Send, Square } from 'lucide-react';
import './AIAssistantTab.css';

const AIAssistantComposer = ({ onSend, onStop = undefined, disabled = false, isStreaming = false }) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (isStreaming || !text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="ai-composer">
      <div className="ai-composer-wrapper">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask TDIS AI anything..."
          disabled={disabled || isStreaming}
          rows={1}
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="ai-send-btn ai-send-btn--stop"
            title="Stop generating"
            aria-label="Stop generating"
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            className="ai-send-btn"
            title="Send message"
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

AIAssistantComposer.propTypes = {
  onSend: PropTypes.func.isRequired,
  onStop: PropTypes.func,
  disabled: PropTypes.bool,
  isStreaming: PropTypes.bool,
};

export default AIAssistantComposer;
