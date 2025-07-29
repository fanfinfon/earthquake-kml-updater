const axios = require('axios');
const fs = require('fs');
const path = require('path');

const KML_PATH = path.join(__dirname, 'earthquake.kml');

function formatKandilliDateToISO(dateStr) {
  const [datePart, timePart] = dateStr.split(' ');
  const [year, month, day] = datePart.split('.');
  return new Date(`${year}-${month}-${day}T${timePart}+03:00`).toISOString(); // Turkish local time
}

function isWithinLast7Days(isoDate) {
  const now = new Date();
  const eventDate = new Date(isoDate);
  return (now - eventDate) <= 7 * 24 * 60 * 60 * 1000; // 7 days
}

function extractEarthquakeIDsFromKML(kmlContent) {
  const idRegex = /<ExtendedData>[\s\S]*?<Data name="earthquake_id">[\s\S]*?<value>(.*?)<\/value>/g;
  const ids = [];
  let match;
  while ((match = idRegex.exec(kmlContent)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

(async () => {
  try {
    const { data } = await axios.get('https://api.orhanaydogdu.com.tr/deprem/kandilli/live');
    const newQuakes = data.result.filter(eq => eq.mag > 2.0);

    // Load existing earthquake IDs from current KML (if exists)
    let existingIDs = [];
    if (fs.existsSync(KML_PATH)) {
      const kmlContent = fs.readFileSync(KML_PATH, 'utf8');
      existingIDs = extractEarthquakeIDsFromKML(kmlContent);
    }

    // Keep only new earthquakes not already in the KML
    const uniqueNewQuakes = newQuakes.filter(eq => !existingIDs.includes(eq.earthquake_id));

    // Combine existing + new (load all data again from KML if needed)
    const combinedQuakes = [...newQuakes, ...data.result.filter(eq => existingIDs.includes(eq.earthquake_id))];

    // Filter to keep only those within 7 days
    const recentQuakes = combinedQuakes.filter(eq => isWithinLast7Days(formatKandilliDateToISO(eq.date)));

    // Generate KML
    const placemarks = recentQuakes.map(eq => {
      const coords = eq.geojson?.coordinates || [0, 0];
      const provider = eq.provider || '';
      const title = eq.title || '';
      const rawDate = eq.date || '';
      const isoDate = formatKandilliDateToISO(rawDate);
      const mag = eq.mag || '';
      const depth = eq.depth || '';
      const earthquakeId = eq.earthquake_id || '';

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
        <ExtendedData>
          <Data name="earthquake_id">
            <value>${earthquakeId}</value>
          </Data>
        </ExtendedData>
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
    console.log(`✅ KML updated. Entries: ${recentQuakes.length}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
