/**
 * @fileoverview OSA (Operational Situational Awareness) layer configuration.
 * Centralizes LAYER_CONFIG and layer identifier helpers for OSATab.
 */

import { Zap, MapPin } from 'lucide-react';
import { TRAFFIC_HAZARDS_LAYER_CONFIG } from './hazardConfig';

/**
 * Layer configuration - Extensible for future layers
 */
export const LAYER_CONFIG = {
  power_outage: {
    id: 'power_outage',
    name: 'Power Outages',
    icon: Zap,
    color: '#ea580c',
    description:
      'Power outage data provides real-time information about electrical service disruptions.',
    gradient: [
      0,
      '#ea580c', // Orange - minimal outages
      1,
      '#ea580c',
      10,
      '#dc2626', // Red - low outages
      50,
      '#dc2626',
      100,
      '#b91c1c', // Darker red - moderate
      500,
      '#b91c1c',
      1000,
      '#7c3aed', // Purple - significant
      2500,
      '#7c3aed',
      5000,
      '#c026d3', // Fuchsia - major
      7500,
      '#c026d3',
      10000,
      '#dc2626', // Bright red - extreme
    ],
    gradientBar:
      'linear-gradient(to right, #ea580c 0%, #ea580c 5%, #dc2626 10%, #dc2626 20%, #b91c1c 30%, #b91c1c 40%, #7c3aed 50%, #7c3aed 62.5%, #c026d3 75%, #c026d3 87.5%, #dc2626 100%)',
    sourceLayerName: 'public.power_outage',
    propertyName: 'CustomersOut',
    thresholds: {
      none: { min: 0, max: 0, color: '#ea580c' },
      minimal: { min: 1, max: 10, color: '#ea580c' },
      low: { min: 10, max: 100, color: '#dc2626' },
      moderate: { min: 100, max: 1000, color: '#b91c1c' },
      significant: { min: 1000, max: 5000, color: '#7c3aed' },
      major: { min: 5000, max: 10000, color: '#c026d3' },
      extreme: { min: 10000, max: Infinity, color: '#dc2626' },
    },
  },
  power_outage_zip: {
    id: 'power_outage_zip',
    name: 'Power Outages by Zip',
    icon: MapPin,
    color: '#ea580c',
    description: 'Zip-level outage data leveraging mv_power_outage_by_zip_centroid view.',
    gradient: [
      0,
      '#ea580c',
      1,
      '#ea580c',
      10,
      '#dc2626',
      50,
      '#dc2626',
      100,
      '#b91c1c',
      500,
      '#b91c1c',
      1000,
      '#7c3aed',
      2500,
      '#7c3aed',
      5000,
      '#c026d3',
      7500,
      '#c026d3',
      10000,
      '#dc2626',
    ],
    gradientBar:
      'linear-gradient(to right, #ea580c 0%, #ea580c 5%, #dc2626 10%, #dc2626 20%, #b91c1c 30%, #b91c1c 40%, #7c3aed 50%, #7c3aed 62.5%, #c026d3 75%, #c026d3 87.5%, #dc2626 100%)',
    sourceLayerName: 'public.mv_power_outage_by_zip_centroid',
    propertyName: 'total_customers_out',
    thresholds: {
      none: { min: 0, max: 0, color: '#ea580c' },
      minimal: { min: 1, max: 10, color: '#ea580c' },
      low: { min: 10, max: 100, color: '#dc2626' },
      moderate: { min: 100, max: 1000, color: '#b91c1c' },
      significant: { min: 1000, max: 5000, color: '#7c3aed' },
      major: { min: 5000, max: 10000, color: '#c026d3' },
      extreme: { min: 10000, max: Infinity, color: '#dc2626' },
    },
  },
  road_closures: {
    ...TRAFFIC_HAZARDS_LAYER_CONFIG,
    id: 'road_closures',
    name: 'Road Weather Hazard Alerts',
    color: '#dc2626',
    showSummaryStats: false,
    summaryStatsViewMode: 'county',
    sourceType: 'hazards',
  },
};

/**
 * Get source and layer IDs for a layer config
 * @param {Object} layerConfig - Entry from LAYER_CONFIG
 * @returns {{ sourceId: string, fillLayerId: string, lineLayerId: string, circleLayerId: string }}
 */
export const getLayerIdentifiers = (layerConfig) => ({
  sourceId: `${layerConfig.id}-source`,
  fillLayerId: `${layerConfig.id}-fill`,
  lineLayerId: `${layerConfig.id}-lines`,
  circleLayerId: `${layerConfig.id}-circles`,
});
