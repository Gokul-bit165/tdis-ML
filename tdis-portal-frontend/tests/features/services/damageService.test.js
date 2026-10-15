import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDamageAssessments,
  getDamageBuilding,
  damageTileUrl,
} from '@/services/damageService';

describe('damageService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('formats damageTileUrl correctly', () => {
    const url = damageTileUrl(123, 'h3');
    expect(url).toContain('/api/v1/damage/tiles/123/h3/{z}/{x}/{y}.mvt');
  });

  it('fetches assessments list', async () => {
    const mockAssessments = [
      { assessment_id: 1, event_name: 'Hurricane Beryl', aoi_name: 'Houston' },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockAssessments,
    });

    const result = await getDamageAssessments();
    expect(result).toEqual(mockAssessments);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/damage/assessments'),
      expect.any(Object)
    );
  });

  it('fetches building detail with signal', async () => {
    const mockBuilding = { building_id: 'b123', damage_class: 2 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockBuilding,
    });

    const controller = new AbortController();
    const result = await getDamageBuilding(1, 'b123', controller.signal);
    expect(result).toEqual(mockBuilding);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/damage/assessments/1/buildings/b123'),
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it('throws on non-ok responses with status code attached', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'Building not found',
    });

    await expect(getDamageBuilding(1, 'unknown')).rejects.toThrow('Damage API 404');
  });
});
