/**
 * @fileoverview Reusable info modal component with backdrop.
 * Used for displaying detailed information about map layers and features.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div;
import { X } from 'lucide-react';

/**
 * InfoModal Component
 *
 * A modal dialog with backdrop for displaying information content.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback when modal should close
 * @param {string} props.title - Modal title
 * @param {string} props.subtitle - Modal subtitle
 * @param {React.ElementType} props.icon - Icon component for the header
 * @param {string} props.iconColor - Color for the header icon
 * @param {string} props.headerGradient - Gradient classes for header background
 * @param {React.ReactNode} props.children - Modal content
 * @param {string} props.maxWidth - Max width of modal (default: 'max-w-lg')
 * @param {string} props.maxHeight - Max height of modal (default: '85vh')
 */
const InfoModal = ({
  isOpen = false,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconColor = 'white',
  headerGradient = 'from-[#324755] to-[#334755]',
  children,
  maxWidth = 'max-w-lg',
  maxHeight = '85vh',
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClose();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Close modal"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            style={{ pointerEvents: 'auto' }}
          />

          {/* Modal */}
          <MotionDiv
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ pointerEvents: 'none' }}
          >
            <div
              className={`bg-white rounded-xl shadow-2xl border border-gray-200 w-full ${maxWidth} max-h-[${maxHeight}] overflow-hidden flex flex-col`}
              style={{ pointerEvents: 'auto' }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              tabIndex={0}
            >
              {/* Header */}
              <div
                className={`flex items-center justify-between p-5 pb-4 border-b border-gray-200 bg-gradient-to-r ${headerGradient}`}
              >
                <div className="flex items-center gap-3">
                  {Icon && <Icon className="w-5 h-5" style={{ color: iconColor }} />}
                  <div>
                    <h2 className="text-lg font-bold text-white">{title}</h2>
                    {subtitle && <p className="text-xs text-white/80">{subtitle}</p>}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto flex-1 p-5 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                {children}
              </div>
            </div>
          </MotionDiv>
        </>
      )}
    </AnimatePresence>
  );
};

export default InfoModal;
