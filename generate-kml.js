const axios = require('axios');
const fs = require('fs');
const path = require('path');

const ARCHIVE_PATH = path.join(__dirname, 'archive.json');
const KML_PATH = path.join(__dirname, 'earthquake.kml');

function formatKandilliDateToISO(dateStr) {
  // "2025.07.28 09:07:03" → "2025-07-28T09:07:03Z"
  const [datePart, timePart] = dateStr.split(' ');
  const [year, month, day] = datePart.split('.');
  return new Date(`${year}-${month}-${day}T${timePart}Z`).toISOString();
}

function isWithinLast7Days(isoDate) {
  const now = new Date();
  const eventDate = new Date(isoDate);
  return (now - eventDate) <= 7 * 24 * 60 * 60 * 1000; // 7 days
}

(async () => {
  try {
    const { data } = await axios.get('https://api.orhanaydogdu.com.tr/deprem/kandilli/live');
    const newQuakes = data.result.filter(eq => eq.mag > 3.8);

    let archive = [];

    // Load existing archive
    if (fs.existsSync(ARCHIVE_PATH)) {
      archive = JSON.parse(fs.readFileSync(ARCHIVE_PATH, 'utf8'));
    }

    // Append new, unique earthquakes
    for (const eq of newQuakes) {
      if (!archive.find(e => e.earthquake_id === eq.earthquake_id)) {
        archive.push(eq);
      }
    }

    // Remove entries older than 7 days
    archive = archive.filter(eq => {
      const isoDate = formatKandilliDateToISO(eq.date);
      return isWithinLast7Days(isoDate);
    });

    // Save updated archive
    fs.writeFileSync(ARCHIVE_PATH, JSON.stringify(archive, null, 2), 'utf8');

    // Generate KML from archive
    const placemarks = archive.map(eq => {
      const coords = eq.geojson?.coordinates || [0, 0];
      const provider = eq.provider || '';
      const title = eq.title || '';
      const rawDate = eq.date || '';
      const isoDate = formatKandilliDateToISO(rawDate);
      const mag = eq.mag || '';
      const depth = eq.depth || '';

      const closestCities = eq.location_properties?.closestCities || [];
      const closestCityList = closestCities.map(c => c.name).join(', ') || (eq.location_properties?.closestCity?.name || 'N/A');

      const airports = eq.location_properties?.airports || [];
      const airportList = airports.map(a => `${a.name} (${a.code})`).join(', ') || 'N/A';

      return `
      <Placemark>
        <name>${title}</name>
        <TimeStamp>
          <when>${isoDate}</when>
        </TimeStamp>
        <description><![CDATA[
          <b>Provider:</b> ${provider}<br/>
          <b>Date:</b> ${rawDate}<br/>
          <b>Magnitude:</b> ${mag}<br/>
          <b>Depth:</b> ${depth} km<br/>
          <b>Closest Cities:</b> ${closestCityList}<br/>
          <b>Nearby Airports:</b> ${airportList}
        ]]></description>
        <Style>
          <IconStyle>
            <color>ff0000ff</color>
            <scale>1.2</scale>
            <Icon>
              <href>https://maps.google.com/mapfiles/kml/shapes/earthquake.png</href>
            </Icon>
          </IconStyle>
        </Style>
        <Point>
          <coordinates>${coords[0]},${coords[1]},0</coordinates>
        </Point>
      </Placemark>`;
    }).join("\n");

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Earthquake Data (Last 7 Days)</name>
    ${placemarks}
  </Document>
</kml>`;

    fs.writeFileSync(KML_PATH, kml, 'utf8');
    console.log('✅ KML file updated with last 7 days of data.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();

