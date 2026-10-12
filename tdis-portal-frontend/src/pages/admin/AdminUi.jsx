import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 rounded-lg border border-[#CBD1D3] bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#87BCBF]">TDIS AI</p>
          <h2 className="mt-1 text-2xl font-bold text-[#324755]">{title}</h2>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed text-[#334755]/75">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function PageError({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-white p-4">
      <p className="text-sm font-medium text-destructive">{message}</p>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          className="mt-3 border-[#CBD1D3] text-[#324755]"
          onClick={onRetry}
        >
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function StatusBadge({ children, variant = 'default' }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold',
        variant === 'destructive'
          ? 'border-destructive/40 text-destructive'
          : 'border-[#CBD1D3] bg-[#F0F3F4] text-[#324755]'
      )}
    >
      {children}
    </span>
  );
}

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  action: PropTypes.node,
};

PageError.propTypes = {
  message: PropTypes.string.isRequired,
  onRetry: PropTypes.func,
};

StatusBadge.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['default', 'destructive']),
};
