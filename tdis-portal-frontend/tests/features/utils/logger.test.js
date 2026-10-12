/**
 * @fileoverview Unit tests for utils/logger
 * Feature: utils
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, mapLogger, hmedLogger, osaLogger, getCurrentLogLevel } from '@/utils/logger';

describe('utils/logger', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('returns an object with debug, info, warn, error methods', () => {
      const logger = createLogger('[Test]');
      expect(logger).toHaveProperty('debug');
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('error');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('prepends prefix to messages when logging', () => {
      const logger = createLogger('[MyPrefix]');
      logger.warn('test message');
      expect(consoleSpy.warn).toHaveBeenCalledWith('[MyPrefix]', 'test message');
    });

    it('does not write debug messages to console.log by default', () => {
      const logger = createLogger('[Debug]');
      logger.debug('msg');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('error calls console.error with prefix', () => {
      const logger = createLogger('[Err]');
      logger.error('err');
      expect(consoleSpy.error).toHaveBeenCalledWith('[Err]', 'err');
    });
  });

  describe('getCurrentLogLevel', () => {
    const originalVerbose = import.meta.env.VITE_VERBOSE_LOGS;
    const originalDev = import.meta.env.DEV;

    afterEach(() => {
      import.meta.env.VITE_VERBOSE_LOGS = originalVerbose;
      import.meta.env.DEV = originalDev;
    });

    it('returns debug when verbose logs are enabled', () => {
      import.meta.env.VITE_VERBOSE_LOGS = 'true';
      expect(getCurrentLogLevel()).toBe('debug');
    });

    it('returns info in development when verbose logs are off', () => {
      import.meta.env.VITE_VERBOSE_LOGS = 'false';
      import.meta.env.DEV = true;
      expect(getCurrentLogLevel()).toBe('info');
    });

    it('returns warn outside development', () => {
      import.meta.env.VITE_VERBOSE_LOGS = 'false';
      import.meta.env.DEV = false;
      expect(getCurrentLogLevel()).toBe('warn');
    });
  });

  describe('pre-configured loggers', () => {
    it('mapLogger is defined', () => {
      expect(mapLogger).toBeDefined();
      expect(mapLogger.debug).toBeDefined();
    });

    it('hmedLogger is defined', () => {
      expect(hmedLogger).toBeDefined();
    });

    it('osaLogger is defined', () => {
      expect(osaLogger).toBeDefined();
    });
  });
});
