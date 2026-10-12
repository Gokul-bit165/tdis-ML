/**
 * @fileoverview Centralized logging utility with configurable log levels.
 * Reduces console noise in production while allowing detailed debugging in development.
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

export function getCurrentLogLevel() {
  if (import.meta.env.VITE_VERBOSE_LOGS === 'true') return 'debug';
  if (import.meta.env.DEV) return 'info';
  return 'warn';
}

// Default: no debug console.log in the browser. Set VITE_VERBOSE_LOGS=true to enable.
const currentLevel = getCurrentLogLevel();

/**
 * Creates a prefixed logger for a specific component/module
 * @param {string} prefix - The prefix to add to all log messages (e.g., '[HMED]', '[OSA]')
 * @returns {Object} Logger object with debug, info, warn, error methods
 */
export const createLogger = (prefix) => {
  const shouldLog = (level) => LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];

  return {
    debug: (...args) => {
      if (shouldLog('debug')) {
        console.log(prefix, ...args);
      }
    },
    info: (...args) => {
      if (shouldLog('info')) {
        console.info(prefix, ...args);
      }
    },
    warn: (...args) => {
      if (shouldLog('warn')) {
        console.warn(prefix, ...args);
      }
    },
    error: (...args) => {
      if (shouldLog('error')) {
        console.error(prefix, ...args);
      }
    },
  };
};

// Pre-configured loggers for common components
export const mapLogger = createLogger('[Map]');
export const hmedLogger = createLogger('[HMED]');
export const osaLogger = createLogger('[OSA]');

export default {
  createLogger,
  mapLogger,
  hmedLogger,
  osaLogger,
};
