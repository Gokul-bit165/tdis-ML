import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDamageInteractions } from '@/hooks/useDamageInteractions';
import { DAMAGE_VIEWS } from '@/config/damageAssessmentConfig';
import * as damageService from '@/services/damageService';

describe('useDamageInteractions', () => {
  let mockMap;
  let listeners;

  beforeEach(() => {
    listeners = {};
    mockMap = {
      getZoom: vi.fn().mockReturnValue(15),
      getCanvas: vi.fn().mockReturnValue({ style: {} }),
      on: vi.fn((event, layer, handler) => {
        listeners[`${event}:${layer}`] = handler;
      }),
      off: vi.fn(),
      setFeatureState: vi.fn(),
    };
  });

  it('a second building click aborts the first detail request', async () => {
    const signals = [];
    let resolveFirst;

    vi.spyOn(damageService, 'getDamageBuilding').mockImplementation(
      (aid, buildingId, signal) => {
        signals.push(signal);
        if (signals.length === 1) {
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve({ building_id: buildingId, damage_class: 2 });
      }
    );

    const onSelectBuilding = vi.fn();
    const setIsLoadingBuilding = vi.fn();
    const setBuildingError = vi.fn();

    renderHook(() =>
      useDamageInteractions({
        map: mockMap,
        assessmentId: 1,
        view: DAMAGE_VIEWS.BUILDINGS,
        onSelectBuilding,
        setIsLoadingBuilding,
        setBuildingError,
      })
    );

    const clickHandler = listeners['click:damage-buildings-fill'];
    expect(clickHandler).toBeDefined();

    // First building click
    await act(async () => {
      clickHandler({
        features: [{ id: 'bldg-1', properties: { building_id: 'bldg-1' } }],
      });
    });

    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);

    // Second building click immediately afterwards
    await act(async () => {
      clickHandler({
        features: [{ id: 'bldg-2', properties: { building_id: 'bldg-2' } }],
      });
    });

    expect(signals).toHaveLength(2);
    // Crucial check: First request was aborted by the second click
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);

    // Resolve first promise (should be ignored because signal was aborted)
    if (resolveFirst) {
      resolveFirst({ building_id: 'bldg-1', damage_class: 1 });
    }

    expect(onSelectBuilding).toHaveBeenCalledWith(
      expect.objectContaining({ building_id: 'bldg-2' })
    );
  });
});
