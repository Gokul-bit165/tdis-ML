/**
 * @fileoverview Script to generate SQL statements for importing Texas city boundaries from GeoJSON.
 * This script reads city boundary data from a GeoJSON file and generates SQL statements
 * to upsert the data into a cities table with PostGIS geometry support.
 */

const fs = require('fs');
const path = require('path');

/**
 * Generates SQL statements from GeoJSON file and writes them to an SQL file.
 * For each city in the GeoJSON:
 * 1. Extracts the city name and geometry
 * 2. Generates UPSERT SQL statements with PostGIS functions
 * 
 * @async
 * @function generateSQL
 * @throws {Error} If there are issues with file reading or writing
 */
async function generateSQL() {
  try {
    const geojsonPath = path.join(__dirname, 'texas_cities.geojson');
    const outputPath = path.join(__dirname, 'seed_cities.sql');
    const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

    // Start building the SQL file content
    let sqlContent = `-- Generated SQL for importing Texas city boundaries
-- Generated on: ${new Date().toISOString()}

-- Begin transaction
BEGIN;

`;

    // Generate INSERT statements for each city
    for (const feature of geojson.features) {
      const name = feature.properties.NAME || 'Unknown';
      const geometry = JSON.stringify(feature.geometry);

      sqlContent += `-- Upserting city: ${name}
INSERT INTO cities (city, geom)
VALUES ('${name.replace(/'/g, "''")}', ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON('${geometry.replace(/'/g, "''")}')), 4326))
ON CONFLICT (city)
DO UPDATE SET geom = EXCLUDED.geom;

`;
    }

    // Add transaction commit
    sqlContent += `\nCOMMIT;`;

    // Write the SQL content to file
    fs.writeFileSync(outputPath, sqlContent);
    console.log(`✅ SQL file generated successfully at: ${outputPath}`);
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

generateSQL();
