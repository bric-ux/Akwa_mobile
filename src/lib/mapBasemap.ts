/**
 * Même fond que le site : OpenStreetMap France (commerces, restaurants, parcs).
 * Secours Esri uniquement si aucune tuile OSM ne charge.
 * Le snippet suppose une variable Leaflet `map` déjà créée.
 */
export const AKWA_LEAFLET_BASEMAP_JS = `
(function attachAkwaBasemap(map) {
  var primary = L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 20,
    subdomains: 'abc'
  });
  primary.addTo(map);
  var loaded = 0, errors = 0, switched = false;
  primary.on('tileload', function () { loaded += 1; });
  primary.on('tileerror', function () {
    errors += 1;
    if (switched || loaded > 0 || errors < 8) return;
    switched = true;
    try { map.removeLayer(primary); } catch (e) {}
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 19
    }).addTo(map);
  });
})(map);
`.trim();

export const AKWA_MAP_BASE_CSS = `
.leaflet-container { background: #e7eef2; }
.leaflet-control-attribution {
  font-size: 10px;
  line-height: 1.2;
  padding: 2px 6px;
  color: #64748b;
  background: rgba(255,255,255,0.82);
}
`.trim();
