import React from 'react';
import { Gauge, Loader2 } from 'lucide-react';
import { formatQuotaResetDate } from '@/services/threadService';
import './AIAssistantTab.css';

/**
 * @param {object} props
 * @param {{ allocated: number, consumed: number, remaining: number, resetDate: string | null } | null} props.quota
 * @param {boolean} [props.loading]
 * @param {string | null} [props.error]
 */
const AIAssistantQuotaBar = ({ quota, loading = false, error = null }) => {
  if (loading) {
    return (
      <div className="ai-quota-bar ai-quota-bar--loading" role="status" aria-live="polite">
        <Loader2 className="ai-quota-bar__icon ai-quota-bar__icon--spin" size={14} aria-hidden />
        <span>Loading query allowance…</span>
      </div>
    );
  }

  if (error || !quota || quota.allocated <= 0) {
    return null;
  }

  const { allocated, consumed, remaining, resetDate } = quota;
  const usedPercent = Math.min(100, Math.round((consumed / allocated) * 100));
  const remainingPercent = (remaining / allocated) * 100;
  const tone = remaining <= 0 ? 'exhausted' : remainingPercent < 25 ? 'low' : 'ok';

  return (
    <div
      className={`ai-quota-bar ai-quota-bar--${tone}`}
      role="status"
      aria-live="polite"
      aria-label={`${remaining} of ${allocated} AI queries remaining this billing period`}
    >
      <div className="ai-quota-bar__lead">
        <Gauge className="ai-quota-bar__icon" size={14} strokeWidth={2} aria-hidden />
        <span className="ai-quota-bar__text">
          <strong>{consumed}</strong> of {allocated} used
          <span className="ai-quota-bar__sep" aria-hidden>
            {' '}
            ·{' '}
          </span>
          <strong>{remaining}</strong> remaining
        </span>
      </div>
      <div className="ai-quota-bar__track" aria-hidden>
        <div className="ai-quota-bar__fill" style={{ width: `${usedPercent}%` }} />
      </div>
      {remaining <= 0 && resetDate ? (
        <p className="ai-quota-bar__hint">
          Limit reached. Resets on {formatQuotaResetDate(resetDate)}.
        </p>
      ) : resetDate ? (
        <p className="ai-quota-bar__hint ai-quota-bar__hint--muted">
          Resets {formatQuotaResetDate(resetDate)}
        </p>
      ) : null}
    </div>
  );
};

export default AIAssistantQuotaBar;
