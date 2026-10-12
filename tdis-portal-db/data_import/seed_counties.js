/**
 * @fileoverview Script to import Texas county boundaries from GeoJSON into a PostgreSQL database.
 * This script reads county boundary data from a GeoJSON file and upserts it into a counties table
 * with PostGIS geometry support.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * PostgreSQL client instance configured with environment variables
 * @type {Client}
 */
const client = new Client({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
  port: process.env.PORT,
});
console.log(process.env.HOST);

/**
 * Imports county boundary data from GeoJSON file into the database.
 * For each county in the GeoJSON:
 * 1. Extracts the county name and geometry
 * 2. Removes "County" suffix from names
 * 3. Upserts the data into the counties table using PostGIS functions
 * 
 * @async
 * @function importGeoJSON
 * @throws {Error} If there are issues with file reading, database connection, or query execution
 */
async function importGeoJSON() {
  try {
    await client.connect();

    const geojsonPath = path.join(__dirname, 'tx_counties.geojson');
    const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

    for (const feature of geojson.features) {
      const countyNameRaw = feature.properties.COUNTY || 'Unknown';
      const name = countyNameRaw.replace(/ County$/, '');
      const geometry = JSON.stringify(feature.geometry);

      const query = `
        INSERT INTO counties (county, geom)
        VALUES ($1, ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON($2)), 4326))
        ON CONFLICT (county)
        DO UPDATE SET geom = EXCLUDED.geom
      `;

      await client.query(query, [name, geometry]);
      console.log(`Upserted county: ${name}`);
    }

    console.log('✅ All counties upserted successfully.');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await client.end();
  }
}

importGeoJSON();
