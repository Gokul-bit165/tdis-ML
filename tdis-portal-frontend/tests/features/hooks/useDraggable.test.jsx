/**
 * @fileoverview Unit tests for hooks/useDraggable
 * Feature: hooks
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useEffect } from 'react';
import { renderHook, render, screen, act } from '@testing-library/react';
import { useDraggable } from '@/hooks/useDraggable';

function DraggablePanel({ initialPosition = 'bottom-right' }) {
  const { dragHandleRef, panelRef, style } = useDraggable({ initialPosition });
  return (
    <div
      id="container"
      data-testid="container"
      style={{ position: 'relative', width: 800, height: 600 }}
    >
      <div ref={panelRef} style={style} data-testid="panel">
        <div ref={dragHandleRef} data-testid="handle">
          Handle
        </div>
      </div>
    </div>
  );
}

describe('hooks/useDraggable', () => {
  beforeEach(() => {
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });

  afterEach(() => {
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });

  it('returns position, setPosition, isDragging, dragHandleRef, panelRef, style', () => {
    const { result } = renderHook(() => useDraggable());
    expect(result.current).toHaveProperty('position');
    expect(result.current).toHaveProperty('setPosition');
    expect(result.current).toHaveProperty('isDragging');
    expect(result.current).toHaveProperty('dragHandleRef');
    expect(result.current).toHaveProperty('panelRef');
    expect(result.current).toHaveProperty('style');
  });

  it('initial isDragging is false', () => {
    const { result } = renderHook(() => useDraggable());
    expect(result.current.isDragging).toBe(false);
  });

  it('default position is bottom-right', () => {
    const { result } = renderHook(() => useDraggable());
    expect(result.current.position).toEqual({ bottom: 16, right: 16 });
  });

  it('accepts initialPosition top-left', () => {
    const { result } = renderHook(() => useDraggable({ initialPosition: 'top-left' }));
    expect(result.current.position).toEqual({ top: 16, left: 16 });
  });

  it('accepts initialPosition top-right', () => {
    const { result } = renderHook(() => useDraggable({ initialPosition: 'top-right' }));
    expect(result.current.position).toEqual({ top: 16, right: 16 });
  });

  it('accepts initialPosition bottom-left', () => {
    const { result } = renderHook(() => useDraggable({ initialPosition: 'bottom-left' }));
    expect(result.current.position).toEqual({ bottom: 16, left: 16 });
  });

  it('invalid initialPosition falls back to bottom-right', () => {
    const { result } = renderHook(() => useDraggable({ initialPosition: 'invalid' }));
    expect(result.current.position).toEqual({ bottom: 16, right: 16 });
  });

  it('style has position absolute and zIndex', () => {
    const { result } = renderHook(() => useDraggable());
    expect(result.current.style.position).toBe('absolute');
    expect(result.current.style.zIndex).toBe(10);
  });

  it('style cursor is default when not dragging', () => {
    const { result } = renderHook(() => useDraggable());
    expect(result.current.style.cursor).toBe('default');
  });

  it('mousedown on handle starts drag, mousemove updates position, mouseup ends drag', () => {
    const containerRect = { left: 0, top: 0, width: 800, height: 600 };
    const panelRect = { left: 100, top: 100, width: 200, height: 150 };

    render(<DraggablePanel />);
    const handle = screen.getByTestId('handle');
    const panel = screen.getByTestId('panel');
    const container = screen.getByTestId('container');
    handle.getBoundingClientRect = () => panelRect;
    panel.getBoundingClientRect = () => panelRect;
    container.getBoundingClientRect = () => containerRect;

    act(() => {
      handle.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          clientX: 150,
          clientY: 125,
          cancelable: true,
        })
      );
    });

    expect(document.body.style.cursor).toBe('move');
    expect(document.body.style.userSelect).toBe('none');

    act(() => {
      document.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 200,
          clientY: 175,
        })
      );
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  it('mousemove uses right/bottom when position is in right half', () => {
    const containerRect = { left: 0, top: 0, width: 800, height: 600 };
    const panelRect = { left: 500, top: 400, width: 200, height: 150 };
    render(<DraggablePanel />);
    const handle = screen.getByTestId('handle');
    const panel = screen.getByTestId('panel');
    const container = screen.getByTestId('container');
    panel.getBoundingClientRect = () => ({ ...panelRect, width: 200, height: 150 });
    container.getBoundingClientRect = () => ({ ...containerRect, width: 800, height: 600 });

    act(() => {
      handle.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 550, clientY: 450, cancelable: true })
      );
    });
    act(() => {
      document.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, clientX: 600, clientY: 500 })
      );
    });
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    expect(document.body.style.cursor).toBe('');
  });

  it('mousedown outside handle does not start drag', () => {
    render(<DraggablePanel />);
    const handle = screen.getByTestId('handle');
    // Dispatch on handle but with target set to body so contains(e.target) is false
    const ev = new MouseEvent('mousedown', {
      bubbles: true,
      clientX: 50,
      clientY: 50,
      cancelable: true,
    });
    Object.defineProperty(ev, 'target', { value: document.body, writable: false });
    act(() => {
      handle.dispatchEvent(ev);
    });
    expect(document.body.style.cursor).toBe('');
  });

  it('mousedown on button inside handle does not start drag', () => {
    function PanelWithButton() {
      const { dragHandleRef, panelRef, style } = useDraggable();
      return (
        <div
          id="container"
          data-testid="container"
          style={{ position: 'relative', width: 800, height: 600 }}
        >
          <div ref={panelRef} style={style} data-testid="panel">
            <div ref={dragHandleRef} data-testid="handle">
              <button type="button">Click me</button>
            </div>
          </div>
        </div>
      );
    }
    render(<PanelWithButton />);
    const button = screen.getByRole('button', { name: 'Click me' });
    act(() => {
      button.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 50, clientY: 50, cancelable: true })
      );
    });
    expect(document.body.style.cursor).toBe('');
  });

  it('mousedown on link inside handle does not start drag', () => {
    function PanelWithLink() {
      const { dragHandleRef, panelRef, style } = useDraggable();
      return (
        <div
          id="container"
          data-testid="container"
          style={{ position: 'relative', width: 800, height: 600 }}
        >
          <div ref={panelRef} style={style}>
            <div ref={dragHandleRef}>
              <a href="#test">Link</a>
            </div>
          </div>
        </div>
      );
    }
    render(<PanelWithLink />);
    const link = screen.getByRole('link', { name: 'Link' });
    act(() => {
      link.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 50, clientY: 50, cancelable: true })
      );
    });
    expect(document.body.style.cursor).toBe('');
  });

  it('mousedown on input inside handle does not start drag', () => {
    function PanelWithInput() {
      const { dragHandleRef, panelRef, style } = useDraggable();
      return (
        <div id="container" style={{ position: 'relative', width: 800, height: 600 }}>
          <div ref={panelRef} style={style}>
            <div ref={dragHandleRef}>
              <input type="text" aria-label="Input" />
            </div>
          </div>
        </div>
      );
    }
    render(<PanelWithInput />);
    const input = screen.getByRole('textbox', { name: 'Input' });
    act(() => {
      input.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 50, clientY: 50, cancelable: true })
      );
    });
    expect(document.body.style.cursor).toBe('');
  });

  it('mousedown on select inside handle does not start drag', () => {
    function PanelWithSelect() {
      const { dragHandleRef, panelRef, style } = useDraggable();
      return (
        <div id="container" style={{ position: 'relative', width: 800, height: 600 }}>
          <div ref={panelRef} style={style}>
            <div ref={dragHandleRef}>
              <select aria-label="Select">
                <option>One</option>
              </select>
            </div>
          </div>
        </div>
      );
    }
    render(<PanelWithSelect />);
    const select = screen.getByRole('combobox', { name: 'Select' });
    act(() => {
      select.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 50, clientY: 50, cancelable: true })
      );
    });
    expect(document.body.style.cursor).toBe('');
  });

  it('mousedown on element with role=button does not start drag', () => {
    function PanelWithRoleButton() {
      const { dragHandleRef, panelRef, style } = useDraggable();
      return (
        <div id="container" style={{ position: 'relative', width: 800, height: 600 }}>
          <div ref={panelRef} style={style}>
            <div ref={dragHandleRef}>
              <span role="button" tabIndex={0}>
                Action
              </span>
            </div>
          </div>
        </div>
      );
    }
    render(<PanelWithRoleButton />);
    const roleButton = screen.getByRole('button', { name: 'Action' });
    act(() => {
      roleButton.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 50, clientY: 50, cancelable: true })
      );
    });
    expect(document.body.style.cursor).toBe('');
  });

  it('setPosition can update position', () => {
    const { result } = renderHook(() => useDraggable());
    act(() => {
      result.current.setPosition({ top: 50, left: 50 });
    });
    expect(result.current.position).toEqual({ top: 50, left: 50 });
  });

  it('mousedown on handle when panelRef is not set does not start drag', () => {
    function HandleOnly() {
      const { dragHandleRef } = useDraggable();
      return (
        <div ref={dragHandleRef} data-testid="handle">
          Handle only
        </div>
      );
    }
    render(<HandleOnly />);
    const handle = screen.getByTestId('handle');
    act(() => {
      handle.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 50, clientY: 50, cancelable: true })
      );
    });
    expect(document.body.style.cursor).toBe('');
  });

  it('mousedown when panel has no parent (container null) does not start drag', () => {
    let hookRefs;
    function RefOverride() {
      hookRefs = useDraggable();
      const { dragHandleRef, panelRef, style } = hookRefs;
      useEffect(() => {
        const detached = document.createElement('div');
        const handleEl = document.createElement('div');
        detached.appendChild(handleEl);
        dragHandleRef.current = handleEl;
        panelRef.current = detached;
      });
      return (
        <div id="container" style={{ position: 'relative', width: 800, height: 600 }}>
          <div ref={panelRef} style={style}>
            <div ref={dragHandleRef}>Handle</div>
          </div>
        </div>
      );
    }
    render(<RefOverride />);
    act(() => {});
    const handleEl = hookRefs.dragHandleRef.current;
    act(() => {
      handleEl.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 50, clientY: 50, cancelable: true })
      );
    });
    expect(document.body.style.cursor).toBe('');
  });
});
