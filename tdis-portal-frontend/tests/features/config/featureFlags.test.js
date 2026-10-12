import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    ACTIVE_WEATHER_EVENTS_BETA_TAB,
    AI_ASSISTANT_TAB,
    isActiveWeatherEventsBetaEnabled,
    resolveActiveTab,
} from '@/config/featureFlags';

const DEFAULT_ACTIVE_WEATHER_TAB = 'active-weather-events';

describe('featureFlags', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe('isActiveWeatherEventsBetaEnabled', () => {
        it('defaults to false when unset', () => {
            vi.stubEnv('VITE_ENABLE_ACTIVE_WEATHER_EVENTS_BETA', undefined);
            expect(isActiveWeatherEventsBetaEnabled()).toBe(false);
        });

        it('parses true values', () => {
            vi.stubEnv('VITE_ENABLE_ACTIVE_WEATHER_EVENTS_BETA', 'true');
            expect(isActiveWeatherEventsBetaEnabled()).toBe(true);
        });

        it('parses false values', () => {
            vi.stubEnv('VITE_ENABLE_ACTIVE_WEATHER_EVENTS_BETA', 'false');
            expect(isActiveWeatherEventsBetaEnabled()).toBe(false);
        });
    });

    describe('resolveActiveTab', () => {
        it('redirects beta tab to default when disabled', () => {
            vi.stubEnv('VITE_ENABLE_ACTIVE_WEATHER_EVENTS_BETA', 'false');
            expect(resolveActiveTab(ACTIVE_WEATHER_EVENTS_BETA_TAB, DEFAULT_ACTIVE_WEATHER_TAB)).toBe(
                DEFAULT_ACTIVE_WEATHER_TAB
            );
        });

        it('keeps beta tab when enabled', () => {
            vi.stubEnv('VITE_ENABLE_ACTIVE_WEATHER_EVENTS_BETA', 'true');
            expect(resolveActiveTab(ACTIVE_WEATHER_EVENTS_BETA_TAB, DEFAULT_ACTIVE_WEATHER_TAB)).toBe(
                ACTIVE_WEATHER_EVENTS_BETA_TAB
            );
        });

        it('redirects AI tab when disabled', () => {
            vi.stubEnv('VITE_ENABLE_TDIS_AI', 'false');
            expect(resolveActiveTab(AI_ASSISTANT_TAB, DEFAULT_ACTIVE_WEATHER_TAB)).toBe(DEFAULT_ACTIVE_WEATHER_TAB);
        });
    });
});
