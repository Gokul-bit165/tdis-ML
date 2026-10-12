/**
 * @fileoverview Hook for OSA summary statistics data: county/zip/utility fetch and derived state.
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  getPowerOutageCounties,
  getPowerOutageZips,
  getPowerOutageUtilities,
} from '../services/powerOutageService';
import { transformCountyData, transformZipData, transformUtilityData } from '../utils/osaDataUtils';

/**
 * @param {Object} currentLayer - Current layer config (LAYER_CONFIG[selectedLayer])
 * @param {React.RefObject} mapRef - Map ref for handleSummaryItemClick flyTo
 * @returns {{
 *   viewMode: string,
 *   setViewMode: Function,
 *   handleViewModeChange: (mode: string) => void,
 *   aggregatedData: Object,
 *   summaryStats: { totalCustomersOut: number, allData: Array },
 *   isLoadingData: boolean,
 *   searchQuery: string,
 *   setSearchQuery: Function,
 *   handleSummaryItemClick: (item: Object) => void
 * }}
 */
export function useOSASummaryData(currentLayer, mapRef) {
  const [viewMode, setViewMode] = useState('county');
  const [searchQuery, setSearchQuery] = useState('');
  const [aggregatedData, setAggregatedData] = useState({
    county: [],
    zip: [],
    utility: [],
  });
  const [isLoadingData, setIsLoadingData] = useState(false);
  const fetchedDataRef = useRef({
    county: false,
    zip: false,
    utility: false,
  });

  const summaryStats = useMemo(() => {
    let data = [];
    let totalCustomersOut = 0;
    const isHazardLayer = currentLayer?.id === 'road_closures';

    if (viewMode === 'county') {
      data = isHazardLayer ? [] : aggregatedData.county || [];
    } else if (viewMode === 'zip') {
      data = aggregatedData.zip || [];
    } else if (viewMode === 'utility') {
      data = aggregatedData.utility || [];
    }

    totalCustomersOut = data.reduce((sum, item) => sum + (item.customersOut || 0), 0);

    let filteredData = data;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredData = data.filter((item) => item.name && item.name.toLowerCase().includes(query));
    }

    const sortedData = [...filteredData].sort(
      (a, b) => (b.customersOut || 0) - (a.customersOut || 0)
    );

    return { totalCustomersOut, allData: sortedData };
  }, [viewMode, aggregatedData, searchQuery, currentLayer]);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setSearchQuery('');
  };

  const handleSummaryItemClick = (item) => {
    const center = item.center;
    if (!mapRef?.current || !center || !Array.isArray(center) || center.length < 2) return;
    const [lng, lat] = center;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    mapRef.current.flyTo({ center: [lng, lat], zoom: 10, duration: 1000 });
  };

  // Fetch counties on mount
  useEffect(() => {
    if (fetchedDataRef.current.county) return;
    const fetchCounties = async () => {
      setIsLoadingData(true);
      try {
        const data = await getPowerOutageCounties();
        const transformed = transformCountyData(data);
        setAggregatedData((prev) => ({ ...prev, county: transformed }));
        fetchedDataRef.current.county = true;
      } catch (error) {
        console.error('Error fetching counties:', error);
        setAggregatedData((prev) => ({ ...prev, county: [] }));
        fetchedDataRef.current.county = true;
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchCounties();
  }, []);

  // Fetch zip when viewMode is zip
  useEffect(() => {
    if (viewMode !== 'zip') return;
    setIsLoadingData(true);
    if (fetchedDataRef.current.zip) {
      setTimeout(() => setIsLoadingData(false), 100);
      return;
    }
    const fetchZips = async () => {
      try {
        const data = await getPowerOutageZips();
        const transformed = transformZipData(data);
        setAggregatedData((prev) => ({ ...prev, zip: transformed }));
        fetchedDataRef.current.zip = true;
      } catch (error) {
        console.error('Error fetching zip codes:', error);
        setAggregatedData((prev) => ({ ...prev, zip: [] }));
        fetchedDataRef.current.zip = true;
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchZips();
  }, [viewMode]);

  // Fetch utilities when viewMode is utility
  useEffect(() => {
    if (viewMode !== 'utility') return;
    setIsLoadingData(true);
    if (fetchedDataRef.current.utility) {
      setTimeout(() => setIsLoadingData(false), 100);
      return;
    }
    const fetchUtilities = async () => {
      try {
        const data = await getPowerOutageUtilities();
        const transformed = transformUtilityData(data);
        setAggregatedData((prev) => ({ ...prev, utility: transformed }));
        fetchedDataRef.current.utility = true;
      } catch (error) {
        console.error('Error fetching utilities:', error);
        setAggregatedData((prev) => ({ ...prev, utility: [] }));
        fetchedDataRef.current.utility = true;
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchUtilities();
  }, [viewMode]);

  return {
    viewMode,
    setViewMode,
    handleViewModeChange,
    aggregatedData,
    summaryStats,
    isLoadingData,
    searchQuery,
    setSearchQuery,
    handleSummaryItemClick,
  };
}
