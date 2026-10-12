/**
 * @file dateUtils.js
 * @description Utility functions for date manipulation and formatting.
 * Provides helper functions for working with dates in the application.
 */

// Function to get the date range for yesterday and today in 'YYYY-MM-DD' format
/**
 * Gets the date range for yesterday and today in 'YYYY-MM-DD' format.
 *
 * This function is used to fetch data for the last two days from the Cube.js backend.
 * It returns an array containing yesterday's and today's dates in ISO format (YYYY-MM-DD).
 *
 * @returns {string[]} Array containing two date strings in 'YYYY-MM-DD' format:
 *                    - First element: Yesterday's date
 *                    - Second element: Today's date
 *
 * @example
 * // Returns: ['2024-04-20', '2024-04-21']
 * const dateRange = getDateRangeForLastTwoDays();
 *
 * // Usage with Cube.js query:
 * const result = await cube.load({
 *   timeDimensions: [{
 *     dimension: 'Events.eventDate',
 *     dateRange: getDateRangeForLastTwoDays()
 *   }]
 * });
 */
export function getDateRangeForLastTwoDays() {
  const todayDate = new Date();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(todayDate.getDate() - 1);

  // Return the formatted dates
  return [yesterdayDate.toISOString().split('T')[0], todayDate.toISOString().split('T')[0]];
}

/**
 * Generates a 24-hour rolling window with explicit ISO timestamps.
 *
 * This function calculates the current UTC time and subtracts 24 hours to create
 * a precise time range for Cube.js queries. It returns an array with exact start
 * and end timestamps in ISO format.
 *
 * @returns {string[]} Array containing two ISO timestamp strings:
 *                    - First element: 24 hours ago in ISO format
 *                    - Second element: Current time in ISO format
 *
 * @example
 * // Returns: ['2024-01-15T10:30:00.000Z', '2024-01-16T10:30:00.000Z']
 * const dateRange = get24HourRollingWindow();
 *
 * // Usage with Cube.js query:
 * const result = await cube.load({
 *   timeDimensions: [{
 *     dimension: 'Events.createdAt',
 *     dateRange: get24HourRollingWindow()
 *   }]
 * });
 */
export function get24HourRollingWindow() {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return [twentyFourHoursAgo.toISOString(), now.toISOString()];
}
