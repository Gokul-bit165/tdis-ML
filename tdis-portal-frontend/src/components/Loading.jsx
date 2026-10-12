import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Loading Component
 *
 * A reusable loading component that displays a spinner and text.
 *
 * @param {Object} props - Component props
 * @param {string} props.text - The text to display while loading
 * @param {string} props.className - Additional CSS classes
 * @returns {JSX.Element} Loading spinner with text
 */
const Loading = ({ text, className }) => {
  return (
    <div
      className={cn(
        'flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-sm px-2 py-1 shadow-md',
        className
      )}
    >
      <div className="animate-spin rounded-full h-3 w-3 border-2 border-primary border-t-transparent" />
      <span className="text-xs text-gray-600">{text}</span>
    </div>
  );
};

export default Loading;
