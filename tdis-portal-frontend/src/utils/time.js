/**
 * @file time.js
 * @description Utility functions for time-related calculations and formatting.
 * Provides helper functions for working with timestamps and time differences.
 * All times are converted to US Central timezone for display using Luxon.
 */

import { DateTime } from 'luxon';

const CENTRAL_TIMEZONE = 'America/Chicago';
const NOT_AVAILABLE = 'N/A';

/**
 * Safely formats a timestamp to Central timezone for popup display
 * This function is specifically designed for use in map popups and other UI elements
 * @param {string} timestamp - The timestamp to format
 * @returns {string} Formatted date string in Central timezone or 'N/A' if invalid
 */
export const formatForPopup = (timestamp) => {
  if (!timestamp) return NOT_AVAILABLE;

  try {
    // Force UTC interpretation if no timezone indicator is present
    const timestampWithZ = timestamp.toString().endsWith('Z') ? timestamp : timestamp + 'Z';
    const dt = DateTime.fromISO(timestampWithZ).setZone(CENTRAL_TIMEZONE);

    return dt.isValid ? dt.toFormat('MM/dd/yyyy, hh:mm:ss a') : NOT_AVAILABLE;
  } catch (error) {
    console.error('Error formatting timestamp for popup:', error);
    return NOT_AVAILABLE;
  }
};

/**
 * Converts a timestamp into a human-readable "time ago" string in Central timezone using Luxon.
 *
 * This function calculates the time difference between the current time and the provided timestamp,
 * returning a human-readable string in the format:
 * - "X hours ago" for differences greater than 1 hour
 * - "X minutes ago" for differences less than 1 hour but greater than 1 minute
 * - "Just now" for differences less than 1 minute
 *
 * @param {Date|string} timestamp - The timestamp to calculate time difference from.
 *                                 Can be a Date object or ISO string.
 * @returns {string} Human-readable time difference string or empty string if timestamp is invalid.
 *
 * @example
 * // Returns: "2 hours ago"
 * getTimeAgo(new Date(Date.now() - 7200000));
 *
 * // Returns: "5 minutes ago"
 * getTimeAgo(new Date(Date.now() - 300000));
 *
 * // Returns: "Just now"
 * getTimeAgo(new Date());
 *
 * // Returns: ""
 * getTimeAgo(null);
 */
export const getTimeAgo = (timestamp) => {
  // Return empty string for invalid timestamps
  if (!timestamp) return '';

  try {
    let dt;

    // Handle different input types
    if (timestamp instanceof Date) {
      // If it's a Date object, convert it to ISO string first
      const isoString = timestamp.toISOString();
      dt = DateTime.fromISO(isoString).setZone(CENTRAL_TIMEZONE);
    } else {
      // If it's a string, handle as before
      const timestampWithZ = timestamp.toString().endsWith('Z') ? timestamp : timestamp + 'Z';
      dt = DateTime.fromISO(timestampWithZ).setZone(CENTRAL_TIMEZONE);
    }

    // Check if the date is valid
    if (!dt.isValid) return '';

    // Get current time in Central timezone
    const now = DateTime.now().setZone(CENTRAL_TIMEZONE);

    // Calculate difference
    const diff = now.diff(dt, ['hours', 'minutes']);
    const diffHours = Math.floor(diff.hours);
    const diffMinutes = Math.floor(diff.minutes);

    if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      return `Just now`;
    }
  } catch (error) {
    console.error('Error calculating time ago:', error);
    return '';
  }
};

/**
 * Formats a timestamp to "Dec 4, 2025 at 9:15 PM CT" format.
 * Assumes the timestamp is already in Central Time (CT) timezone.
 * @param {string} timestamp - The timestamp to format (ISO format, e.g., "2025-12-04T20:45:33.653068")
 * @returns {string} Formatted date string or 'N/A' if invalid
 */
export const formatEventDate = (timestamp) => {
  if (!timestamp) return NOT_AVAILABLE;

  try {
    // Parse the timestamp - it's already in CT, so we parse it as-is
    // The timestamp format is "2025-12-04T20:45:33.653068" (no timezone indicator)
    // We'll parse it and assume it's in Central Time
    const dt = DateTime.fromISO(timestamp, { zone: CENTRAL_TIMEZONE });

    if (!dt.isValid) {
      return NOT_AVAILABLE;
    }

    // Format as "Dec 4, 2025 at 9:15 PM CT"
    return dt.toFormat("LLL d, yyyy 'at' h:mm a 'CST'");
  } catch (error) {
    console.error('Error formatting event date:', error);
    return NOT_AVAILABLE;
  }
};
