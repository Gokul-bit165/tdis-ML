import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reportOnFailure: true,
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/main.jsx',
        'src/**/*.test.{js,jsx}',
        'src/**/index.js',
        '**/node_modules/**',
        'src/components/ui/**/*',
        // Map/Mapbox-heavy modules (require browser/Mapbox for full coverage)
        'src/hooks/useMapboxMap.js',
        'src/hooks/useOSAMapLayers.js',
        'src/hooks/useBaronRainfallGridMapLayers.js',
        'src/hooks/useLtsMapLayers.js',
        'src/hooks/useHMEDMapLayers.js',
        'src/hooks/useHMEDFloodHubOverlays.js',
        'src/hooks/useHazardLayers.js',
        'src/hooks/useHazardMapClick.js',
        'src/hooks/useMapResize.js',
        'src/services/mapService.js',
        'src/services/mapRefreshService.js',
        'src/utils/criticalFacilitiesMapLayers.js',
        'src/components/MapSection.jsx',
        'src/components/LtsFlashFloodTab.jsx',
        'src/components/ActiveWeatherEventsBetaTab.jsx',
        'src/components/ai-assistant/AIAssistantMap.jsx',
        'src/api/cubeClient.js',
      ],
      thresholds: {
        statements: 39,
        branches: 20,
        functions: 28,
        lines: 40,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
