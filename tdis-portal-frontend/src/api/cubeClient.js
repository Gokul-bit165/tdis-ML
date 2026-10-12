/**
 * @file cubeClient.js
 * @description Cube.js client configuration and initialization.
 * Sets up the connection to the Cube.js backend API using environment variables.
 */

import cubejs from '@cubejs-client/core';

// Environment variables for Cube.js configuration
const baseUrl = import.meta.env.VITE_CUBE_API_BASE_URL;
const cubeToken = import.meta.env.VITE_CUBEJS_TOKEN;

/**
 * Cube.js client instance
 *
 * Initializes the Cube.js client with the following configuration:
 * - API token from environment variables
 * - API URL constructed from base URL
 *
 * @type {cubejs.CubejsApi}
 * @example
 * // Usage in components:
 * import cube from '../api/cubeClient';
 *
 * // Make a query
 * const result = await cube.load({
 *   measures: ['Events.count'],
 *   dimensions: ['Events.eventType']
 * });
 */
// Normalize and ensure Cube.js API path (string operations to avoid ReDoS from regex)
let normalizedBaseUrl = (baseUrl || '').trim();
while (normalizedBaseUrl.endsWith('/')) {
  normalizedBaseUrl = normalizedBaseUrl.slice(0, -1);
}
const cubePath = '/cubejs-api/v1';
const apiUrl = normalizedBaseUrl.endsWith(cubePath)
  ? normalizedBaseUrl
  : `${normalizedBaseUrl}${cubePath}`;

const cube = cubejs(cubeToken, {
  apiUrl,
});

export default cube;
