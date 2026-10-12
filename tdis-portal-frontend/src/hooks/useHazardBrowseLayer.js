import { useCallback, useEffect, useState } from 'react';
import { fetchHazardMap } from '@/services/hazardMapService';
import { DEFAULT_HAZARD_METRIC } from '@/config/hazardMapConfig';

/**
 * Owns the hazard browse layer for the AI assistant: which hazard metric is
 * selected and the hexes fetched for it.
 *
 * `preferBrowse` decides whether the map paints hazard hexes or the chat
 * answer's records: a new answer map wins, changing the hazard metric wins back.
 */
export function useHazardBrowseLayer(getToken, enabled = true) {
  const [hazardMetric, setHazardMetric] = useState(DEFAULT_HAZARD_METRIC);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preferBrowse, setPreferBrowse] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!enabled) {
        setRecords([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await fetchHazardMap({ metric: hazardMetric, token: getToken?.() });
        if (cancelled) return;
        setRecords(data.hexes);
      } catch (err) {
        if (cancelled) return;
        setRecords([]);
        setError(err instanceof Error ? err.message : 'Failed to load hazard map');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [enabled, getToken, hazardMetric]);

  const selectMetric = useCallback((metric) => {
    setHazardMetric(metric);
    setPreferBrowse(true);
  }, []);

  const showAnswerMap = useCallback(() => setPreferBrowse(false), []);

  return {
    hazardMetric,
    records,
    loading,
    error,
    preferBrowse,
    selectMetric,
    showAnswerMap,
  };
}
