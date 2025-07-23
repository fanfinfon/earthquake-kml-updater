const axios = require('axios');
const fs = require('fs');
const { create } = require('xmlbuilder2');

(async () => {
  const res = await axios.get('https://api.orhanaydogdu.com.tr/deprem/kandilli/live');
  const data = res.data.result;

  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('kml', { xmlns: 'http://www.opengis.net/kml/2.2' })
    .ele('Document');

  for (const eq of data) {
    const coords = eq.geojson?.coordinates;
    if (!coords) continue;

    const pm = doc.ele('Placemark');
    pm.ele('name').txt(eq.title || 'Earthquake');
    pm.ele('description').dat(
      `Magnitude: ${eq.mag}\nDepth: ${eq.depth}km\nDate: ${eq.date}\nClosest City: ${eq.location_properties?.closestCity?.name || ''}`
    );

    const style = pm.ele('Style').ele('IconStyle');
    style.ele('Icon').ele('href').txt('https://maps.google.com/mapfiles/kml/shapes/earthquake.png');

    pm.ele('Point').ele('coordinates').txt(`${coords[0]},${coords[1]}`);
  }

  const xml = doc.end({ prettyPrint: true });
  fs.writeFileSync('earthquake.kml', xml);
})();
