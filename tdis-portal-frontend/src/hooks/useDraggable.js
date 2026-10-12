import { useState, useRef, useEffect } from 'react';

/**
 * Custom hook for making elements draggable
 * @param {Object} options - Configuration options
 * @param {string} options.initialPosition - Initial position: 'top-left', 'top-right', 'bottom-left', 'bottom-right'
 * @returns {Object} - { position, dragHandleRef, panelRef, isDragging, style }
 */
export const useDraggable = ({ initialPosition = 'bottom-right' } = {}) => {
  // Store position as { top/bottom, left/right, value }
  const [position, setPosition] = useState(() => {
    const defaults = {
      'top-left': { top: 16, left: 16 },
      'top-right': { top: 16, right: 16 },
      'bottom-left': { bottom: 16, left: 16 },
      'bottom-right': { bottom: 16, right: 16 },
    };
    return defaults[initialPosition] || defaults['bottom-right'];
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragHandleRef = useRef(null);
  const panelRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseDown = (e) => {
      if (!dragHandleRef.current || !dragHandleRef.current.contains(e.target)) {
        return;
      }

      // Don't start drag if clicking on a button or interactive element
      const target = e.target;
      if (
        target.tagName === 'BUTTON' ||
        target.closest('button') ||
        target.tagName === 'A' ||
        target.closest('a') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('[role="button"]')
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (!panelRef.current) return;

      const rect = panelRef.current.getBoundingClientRect();
      const container = panelRef.current.parentElement;
      if (!container) return;

      // Calculate offset from mouse to panel top-left
      offsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      setIsDragging(true);
    };

    const dragHandle = dragHandleRef.current;
    if (dragHandle) {
      dragHandle.addEventListener('mousedown', handleMouseDown);
    }

    return () => {
      if (dragHandle) {
        dragHandle.removeEventListener('mousedown', handleMouseDown);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid remounting map/geometry layers
  }, [dragHandleRef.current]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!panelRef.current) return;

      const container = panelRef.current.parentElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const panelRect = panelRef.current.getBoundingClientRect();

      // Calculate new position relative to container
      let newLeft = e.clientX - containerRect.left - offsetRef.current.x;
      let newTop = e.clientY - containerRect.top - offsetRef.current.y;

      // Constrain to container bounds
      const maxLeft = containerRect.width - panelRect.width;
      const maxTop = containerRect.height - panelRect.height;

      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

      // Always use left/top for positioning during drag
      // Convert to right/bottom if closer to those edges
      const useRight = newLeft > containerRect.width / 2;
      const useBottom = newTop > containerRect.height / 2;

      const newPosition = {};
      if (useRight) {
        newPosition.right = containerRect.width - newLeft - panelRect.width;
      } else {
        newPosition.left = newLeft;
      }

      if (useBottom) {
        newPosition.bottom = containerRect.height - newTop - panelRect.height;
      } else {
        newPosition.top = newTop;
      }

      setPosition(newPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'move';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging]);

  const style = {
    position: 'absolute',
    ...position,
    cursor: isDragging ? 'move' : 'default',
    zIndex: 10,
  };

  return {
    position,
    setPosition,
    isDragging,
    dragHandleRef,
    panelRef,
    style,
  };
};
