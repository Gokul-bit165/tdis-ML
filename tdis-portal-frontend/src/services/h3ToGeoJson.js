import * as h3 from 'h3-js';

/**
 * Converts an array of MapRecords (with H3 hex_ids) to a GeoJSON FeatureCollection.
 * Each hex_id is converted to a polygon using h3-js.
 */
export function h3ToGeoJson(mapRecords) {
  const features = mapRecords
    .map((record) => {
      try {
        const rawHexId = record.hex_id;
        if (!rawHexId) {
          console.warn('🗺️ Record missing hex_id:', record);
          return null;
        }

        // Safety: if hex_id arrived as a decimal integer string, convert it.
        // parseOrchestratorResponse handles this for large IDs via regex,
        // but this catches any edge cases that slip through.
        let hexId = String(rawHexId);
        if (/^\d+$/.test(hexId)) {
          hexId = BigInt(hexId).toString(16).padStart(16, '0');
          console.warn('🗺️ Converted decimal hex_id:', rawHexId, '→', hexId);
        }

        // h3-js v4 uses cellToBoundary which returns [lat, lng] pairs
        const boundary = h3.cellToBoundary(hexId, true);

        if (!boundary || boundary.length === 0) {
          console.warn('🗺️ Empty boundary for hex_id:', hexId);
          return null;
        }

        // Convert to [lng, lat] format for GeoJSON
        const coordinates = boundary
          .map((coord) => {
            const [first, second] = coord;

            let lat, lng;

            if (
              typeof first === 'number' &&
              typeof second === 'number' &&
              !isNaN(first) &&
              !isNaN(second)
            ) {
              if ((first < -90 || first > 90) && first >= -180 && first <= 180) {
                lng = first;
                lat = second;
              } else if (first >= -90 && first <= 90) {
                lat = first;
                lng = second;
              } else {
                console.warn(
                  '🗺️ Invalid first coordinate value for hex_id:',
                  hexId,
                  first
                );
                return null;
              }

              if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                return [lng, lat];
              } else {
                console.warn(
                  '🗺️ Invalid coordinate range for hex_id:',
                  hexId,
                  'lat=',
                  lat,
                  'lng=',
                  lng
                );
                return null;
              }
            }

            console.warn('🗺️ Invalid coordinate types for hex_id:', hexId, first, second);
            return null;
          })
          .filter((coord) => coord !== null);

        // Ensure we have valid coordinates
        if (coordinates.length < 3) {
          console.warn(
            '🗺️ Not enough valid coordinates for hex_id:',
            hexId,
            coordinates.length
          );
          return null;
        }

        // Ensure polygon ring is closed
        const firstCoord = coordinates[0];
        const lastCoord = coordinates[coordinates.length - 1];
        if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
          coordinates.push([firstCoord[0], firstCoord[1]]);
        }

        return {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [coordinates],
          },
          properties: {
            ...record,
          },
        };
      } catch (error) {
        console.error('❌ Failed to convert hex_id to GeoJSON:', record.hex_id, error);
        return null;
      }
    })
    .filter((feature) => feature !== null);

  return {
    type: 'FeatureCollection',
    features,
  };
}
