/**
 * @fileoverview Unit tests for critical facility map popup helpers + RAMP GeoJSON load.
 * Feature: utils
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CRITICAL_FACILITY_LAYERS } from '@/config/criticalFacilitiesConfig';
import {
  bindCriticalFacilityInteractions,
  buildCriticalFacilityPopupNode,
  loadCriticalFacilityLayers,
  pickFacilityProp,
  updateCriticalFacilityVisibility,
} from '@/utils/criticalFacilitiesMapLayers';

vi.mock('@/services/criticalFacilitiesService', () => ({
  emptyFacilityCollection: () => ({ type: 'FeatureCollection', features: [] }),
  fetchCriticalFacilityGeoJson: vi.fn(async () => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-97.7, 30.3] },
        properties: { name: 'Station 1' },
      },
    ],
  })),
}));

const HOSPITAL_LABEL = 'Hospital';
const FIRE_LAYER_ID = CRITICAL_FACILITY_LAYERS[0].layerId;

describe('pickFacilityProp', () => {
  it('returns the first non-empty candidate key', () => {
    expect(pickFacilityProp({ NAME: 'Austin FS 1', name: '' }, ['name', 'NAME'])).toBe('Austin FS 1');
  });
});

describe('buildCriticalFacilityPopupNode', () => {
  it('renders facility fields as text nodes so markup is not interpreted', () => {
    const node = buildCriticalFacilityPopupNode(
      {
        name: '<script>alert(1)</script>',
        facility_type: 'Hospital',
        address: '123 Main',
        city: 'Austin',
        zip: 78701,
      },
      HOSPITAL_LABEL
    );

    expect(node.querySelectorAll('script')).toHaveLength(0);
    expect(node.textContent).toContain('<script>alert(1)</script>');
    expect(node.textContent).toContain('123 Main');
    expect(node.textContent).toContain('Austin');
    expect(node.textContent).toContain('78701');
  });

  it('falls back to the layer label when name is missing and omits empty rows', () => {
    const node = buildCriticalFacilityPopupNode({ name: {}, address: '   ' }, HOSPITAL_LABEL);

    expect(node.querySelector('p')?.textContent).toBe(HOSPITAL_LABEL);
    expect(node.textContent).toContain('Type');
    expect(node.textContent).not.toContain('Address');
    expect(node.textContent).not.toContain('Phone');
  });

  it('reads alternate column names for the title', () => {
    const node = buildCriticalFacilityPopupNode({ NAME: 'Station 9' }, 'Fire stations');
    expect(node.querySelector('p')?.textContent).toBe('Station 9');
  });
});

describe('loadCriticalFacilityLayers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers empty geojson sources until a layer is toggled on', async () => {
    const sources = {};
    const layers = {};
    const map = {
      getStyle: () => ({ layers: [] }),
      hasImage: () => true,
      getLayer: (id) => layers[id],
      getSource: (id) => sources[id],
      removeLayer: (id) => {
        delete layers[id];
      },
      removeSource: (id) => {
        delete sources[id];
      },
      addSource: (id, spec) => {
        sources[id] = {
          ...spec,
          setData(data) {
            this.data = data;
          },
        };
      },
      addLayer: (spec) => {
        layers[spec.id] = spec;
      },
      addImage: vi.fn(),
      setLayoutProperty: vi.fn(),
    };

    await loadCriticalFacilityLayers(map, {});

    const fireCfg = CRITICAL_FACILITY_LAYERS[0];
    expect(sources[fireCfg.sourceId]).toEqual(
      expect.objectContaining({
        type: 'geojson',
        data: expect.objectContaining({ type: 'FeatureCollection', features: [] }),
      })
    );
    expect(layers[fireCfg.layerId].layout.visibility).toBe('none');
  });
});

describe('updateCriticalFacilityVisibility', () => {
  it('toggles layout visibility from the legend state', async () => {
    const map = {
      getStyle: () => ({ layers: [] }),
      getLayer: () => ({}),
      getSource: () => ({ type: 'geojson', setData: vi.fn() }),
      setLayoutProperty: vi.fn(),
      hasImage: () => true,
      addImage: vi.fn(),
    };

    await updateCriticalFacilityVisibility(map, {
      fire_stations: true,
      schools: false,
      hospitals: false,
    });

    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      CRITICAL_FACILITY_LAYERS[0].layerId,
      'visibility',
      'visible'
    );
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      CRITICAL_FACILITY_LAYERS[1].layerId,
      'visibility',
      'none'
    );
  });
});

describe('bindCriticalFacilityInteractions', () => {
  it('attaches a DOM popup when a facility point is clicked', () => {
    const handlers = {};
    const map = {
      getStyle: () => ({ layers: [] }),
      getCanvas: () => ({ style: { cursor: '' } }),
      on: (event, layerId, handler) => {
        handlers[`${event}:${layerId}`] = handler;
      },
      off: vi.fn(),
    };

    const cleanup = bindCriticalFacilityInteractions(map);
    handlers[`click:${FIRE_LAYER_ID}`]({
      features: [
        {
          layer: { id: FIRE_LAYER_ID },
          geometry: { type: 'Point', coordinates: [-97.7, 30.3] },
          properties: { name: 'Station 1', address: '1 Oak St' },
        },
      ],
    });

    expect(typeof cleanup).toBe('function');
    cleanup();
    expect(map.off).toHaveBeenCalled();
  });
});
