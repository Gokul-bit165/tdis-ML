import React from 'react';
import './AIAssistantTab.css';

/**
 * Activity waveform instead of a spinner — reads as live signal / streaming without clichéd “loading” UI.
 */
const AIAssistantThinking = () => {
  return (
    <div
      className="ai-thinking"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Assistant is drafting a reply"
    >
      <div className="ai-thinking-wave" aria-hidden>
        <span className="ai-thinking-wave__bar" />
        <span className="ai-thinking-wave__bar" />
        <span className="ai-thinking-wave__bar" />
        <span className="ai-thinking-wave__bar" />
        <span className="ai-thinking-wave__bar" />
      </div>
      <span className="ai-thinking-label">Drafting your reply</span>
    </div>
  );
};

export default AIAssistantThinking;
