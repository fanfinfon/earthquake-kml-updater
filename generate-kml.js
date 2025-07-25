const axios = require('axios');
const fs = require('fs');

(async () => {
  try {
    const { data } = await axios.get('https://api.orhanaydogdu.com.tr/deprem/kandilli/live');
    const earthquakes = data.result;

    const placemarks = earthquakes.map(eq => {
      const coords = eq.geojson?.coordinates || [0, 0]; // [lon, lat]
      const provider = eq.provider || '';
      const title = eq.title || '';
      const date = eq.date || '';
      const mag = eq.mag || '';
      const depth = eq.depth || '';

      const closestCities = eq.location_properties?.closestCities || [];
      const closestCityList = closestCities.map(c => c.name).join(', ') || (eq.location_properties?.closestCity?.name || 'N/A');

      const airports = eq.location_properties?.airports || [];
      const airportList = airports.map(a => `${a.name} (${a.code})`).join(', ') || 'N/A';

      return `
      <Placemark>
        <name>${title}</name>
        <description><![CDATA[
          <b>Provider:</b> ${provider}<br/>
          <b>Date:</b> ${date}<br/>
          <b>Magnitude:</b> ${mag}<br/>
          <b>Depth:</b> ${depth} km<br/>
          <b>Closest Cities:</b> ${closestCityList}<br/>
          <b>Nearby Airports:</b> ${airportList}
        ]]></description>
        <Style>
          <IconStyle>
            <color>ff0000ff</color> <!-- Red -->
            <scale>1.2</scale>
            <Icon>
              <href>https://maps.google.com/mapfiles/kml/shapes/earthquake.png</href>
            </Icon>
          </IconStyle>
        </Style>
        <Point>
          <coordinates>${coords[0]},${coords[1]},0</coordinates>
        </Point>
      </Placemark>
      `;
    }).join("\n");

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Earthquake Data</name>
    ${placemarks}
  </Document>
</kml>`;

    fs.writeFileSync('earthquake.kml', kml, 'utf8');
    console.log('KML file saved successfully.');
  } catch (err) {
    console.error('Failed to generate KML:', err.message);
  }
})();

