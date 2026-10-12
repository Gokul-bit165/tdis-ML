import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import PropTypes from 'prop-types';
import { cn } from '@/lib/utils';

/**
 * Confirmation modal for removing a chat thread (replaces window.confirm).
 */
export function DeleteConversationDialog({ open, threadTitle, onCancel, onConfirm }) {
  const label = threadTitle?.trim() ? threadTitle.trim() : 'Untitled conversation';

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-[200] bg-black/45',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[201] w-[min(92vw,400px)] max-h-[min(90vh,420px)]',
            '-translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-xl',
            'outline-none focus:outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          <Dialog.Title className="text-base font-bold tracking-tight text-[#324755]">
            Delete this conversation?
          </Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-relaxed text-[#64748b]">
            This removes <span className="font-semibold text-[#475569]">&ldquo;{label}&rdquo;</span>{' '}
            from your list. You cannot undo this action.
          </Dialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[#f1f5f9] pt-4">
            <button
              type="button"
              className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-semibold text-[#475569] shadow-sm hover:bg-[#f8fafc]"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#b91c1c] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#991b1b]"
              onClick={onConfirm}
            >
              Delete conversation
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

DeleteConversationDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  threadTitle: PropTypes.string,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

DeleteConversationDialog.defaultProps = {
  threadTitle: '',
};
