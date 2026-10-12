/**
 * @fileoverview useHazardLayers Hook
 * Custom hook for managing hazard map layers, state, and interactions.
 * Encapsulates all hazard layer logic for clean integration with OSATab.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  addHazardSources,
  addHazardLayers,
  setHazardLayersVisibility,
  updateHazardFilters,
  getAllHazardLayerIds,
} from '../utils/hazardMapUtils';
import {
  HAZARD_CATEGORIES,
  getEnabledCategories,
  getEnabledSubtypeIds,
} from '../config/hazardConfig';

/**
 * Get all subtype IDs from enabled categories (for UI toggles)
 */
const _getAllEnabledSubtypeIds = () => {
  const enabledCategories = getEnabledCategories();
  return new Set(Object.values(enabledCategories).flatMap((cat) => cat.subtypes.map((s) => s.id)));
};

/**
 * Get all enabled category IDs
 */
const getAllEnabledCategoryIds = () => {
  return new Set(Object.keys(getEnabledCategories()));
};

/**
 * Custom hook for managing Road Weather Hazard Alerts layers
 *
 * @param {React.MutableRefObject} mapRef - Reference to Mapbox map instance
 * @param {boolean} isActive - Whether the hazard layer is currently selected
 * @param {string} tileServerUrl - Base URL for pg_tileserv
 * @returns {Object} Hook state and methods
 */
export const useHazardLayers = (mapRef, isActive, tileServerUrl) => {
  // State for selected subtypes - ALL subtypes (weather + road) selected so all alert types plot with correct colors
  const [selectedSubtypes, setSelectedSubtypes] = useState(() => getEnabledSubtypeIds());

  // State for expanded categories - ALL expanded by default
  const [expandedCategories, setExpandedCategories] = useState(() => getAllEnabledCategoryIds());

  // Track if layers have been initialized
  const [isInitialized, setIsInitialized] = useState(false);

  // Prevent duplicate initialization
  const initializingRef = useRef(false);

  /**
   * Initialize hazard sources and layers when active
   */
  useEffect(() => {
    const map = mapRef?.current;
    if (!map || !isActive || !tileServerUrl || initializingRef.current) return;

    const initializeLayers = () => {
      if (initializingRef.current || isInitialized) return;
      initializingRef.current = true;

      try {
        addHazardSources(map, tileServerUrl);
        addHazardLayers(map);
        setHazardLayersVisibility(map, true);
        updateHazardFilters(map, selectedSubtypes);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize hazard layers:', error);
      } finally {
        initializingRef.current = false;
      }
    };

    // isActive is only true when OSATab has mapReady, so call init directly (don't wait for style.load).
    initializeLayers();
  }, [mapRef, isActive, tileServerUrl, isInitialized, selectedSubtypes]);

  /**
   * Update layer visibility when active state changes
   */
  useEffect(() => {
    const map = mapRef?.current;
    if (!map || !isInitialized) return;

    setHazardLayersVisibility(map, isActive);
  }, [mapRef, isActive, isInitialized]);

  /**
   * Update filters when selected subtypes change
   */
  useEffect(() => {
    const map = mapRef?.current;
    if (!map || !isInitialized || !isActive) return;

    updateHazardFilters(map, selectedSubtypes);
  }, [mapRef, selectedSubtypes, isInitialized, isActive]);

  /**
   * Toggle category expansion in the UI
   */
  const toggleCategory = useCallback((categoryId) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  /**
   * Toggle individual subtype selection
   */
  const toggleSubtype = useCallback((subtypeId) => {
    setSelectedSubtypes((prev) => {
      const next = new Set(prev);
      if (next.has(subtypeId)) {
        next.delete(subtypeId);
      } else {
        next.add(subtypeId);
      }
      return next;
    });
  }, []);

  /**
   * Toggle all subtypes in a category
   * @param {string} categoryId - Category ID
   * @param {boolean} select - true to select all, false to deselect all
   */
  const toggleCategorySubtypes = useCallback((categoryId, select) => {
    const category = HAZARD_CATEGORIES[categoryId];
    if (!category) return;

    setSelectedSubtypes((prev) => {
      const next = new Set(prev);
      category.subtypes.forEach((sub) => {
        if (select) {
          next.add(sub.id);
        } else {
          next.delete(sub.id);
        }
      });
      return next;
    });
  }, []);

  /**
   * Select all subtypes across all categories (so all alert types show on map)
   */
  const selectAll = useCallback(() => {
    setSelectedSubtypes(getEnabledSubtypeIds());
  }, []);

  /**
   * Clear all selected subtypes
   */
  const clearAll = useCallback(() => {
    setSelectedSubtypes(new Set());
  }, []);

  /**
   * Check if a category has all its subtypes selected
   */
  const isCategoryFullySelected = useCallback(
    (categoryId) => {
      const category = HAZARD_CATEGORIES[categoryId];
      if (!category || category.subtypes.length === 0) return false;
      return category.subtypes.every((sub) => selectedSubtypes.has(sub.id));
    },
    [selectedSubtypes]
  );

  /**
   * Check if a category has some (but not all) subtypes selected
   */
  const isCategoryPartiallySelected = useCallback(
    (categoryId) => {
      const category = HAZARD_CATEGORIES[categoryId];
      if (!category || category.subtypes.length === 0) return false;
      const selectedCount = category.subtypes.filter((sub) => selectedSubtypes.has(sub.id)).length;
      return selectedCount > 0 && selectedCount < category.subtypes.length;
    },
    [selectedSubtypes]
  );

  /**
   * Get count of selected subtypes in a category
   */
  const getSelectedCountForCategory = useCallback(
    (categoryId) => {
      const category = HAZARD_CATEGORIES[categoryId];
      if (!category) return 0;
      return category.subtypes.filter((sub) => selectedSubtypes.has(sub.id)).length;
    },
    [selectedSubtypes]
  );

  /**
   * Cleanup function to reset state when layer is deselected
   */
  const cleanup = useCallback(() => {
    const map = mapRef?.current;
    if (map && isInitialized) {
      setHazardLayersVisibility(map, false);
    }
  }, [mapRef, isInitialized]);

  return {
    // State
    selectedSubtypes,
    expandedCategories,
    isInitialized,

    // Selection actions
    toggleSubtype,
    toggleCategory,
    toggleCategorySubtypes,
    selectAll,
    clearAll,

    // Selection helpers
    isCategoryFullySelected,
    isCategoryPartiallySelected,
    getSelectedCountForCategory,

    // Layer utilities
    layerIds: getAllHazardLayerIds(),
    cleanup,

    // Direct state setters (for edge cases)
    setSelectedSubtypes,
    setExpandedCategories,
  };
};

export default useHazardLayers;
