import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { AKWA_LEAFLET_BASEMAP_JS, AKWA_MAP_BASE_CSS } from '../lib/mapBasemap';

interface PropertyMapProps {
  latitude?: number;
  longitude?: number;
  locationName?: string;
  cityName?: string;
  neighborhoodName?: string;
  title?: string;
  /** Libellé du bouton d'itinéraire. Défaut : « S'y rendre ». */
  directionsLabel?: string;
}

const PropertyMap: React.FC<PropertyMapProps> = ({
  latitude,
  longitude,
  locationName,
  cityName,
  neighborhoodName,
  title = 'Où vous dormirez',
  directionsLabel = "S'y rendre",
}) => {
  // Coordonnées par défaut: Abidjan (centre de la Côte d'Ivoire)
  const defaultLatitude = 5.3600;
  const defaultLongitude = -4.0083;
  
  const hasPoint = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const mapLatitude = hasPoint ? Number(latitude) : defaultLatitude;
  const mapLongitude = hasPoint ? Number(longitude) : defaultLongitude;
  
  console.log('🗺️ Coordonnées de la carte:', { 
    latitude, 
    longitude, 
    mapLatitude, 
    mapLongitude,
    locationName,
    cityName,
    neighborhoodName,
    usingDefault: !latitude || !longitude
  });
  
  const getFullAddress = () => {
    if (locationName?.trim()) return locationName.trim();
    const parts = [];
    if (neighborhoodName) parts.push(neighborhoodName);
    if (cityName) parts.push(cityName);
    if (!parts.length) parts.push('Côte d\'Ivoire');
    return parts.join(', ');
  };

  const handleOpenDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${mapLatitude},${mapLongitude}`;
    Linking.openURL(url).catch(err => console.error('Erreur:', err));
  };

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { width: 100%; height: 100vh; }
        ${AKWA_MAP_BASE_CSS}
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          attributionControl: true,
          zoomControl: false,
        }).setView([${mapLatitude}, ${mapLongitude}], 16);
        ${AKWA_LEAFLET_BASEMAP_JS}
        
        var marker = L.marker([${mapLatitude}, ${mapLongitude}], {
          icon: L.divIcon({
            className: '',
            html: '<div style="width:36px;height:36px;border-radius:50%;background:#e67e22;border:3px solid white;box-shadow:0 2px 8px rgba(230,126,34,0.4);"></div>',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          })
        }).addTo(map);
        
        marker.bindPopup('${getFullAddress()}');
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="location" size={20} color="#e74c3c" />
        <Text style={styles.title}>{title}</Text>
      </View>
      
      <View style={styles.mapContainer}>
        <WebView
          source={{ html: mapHtml }}
          style={styles.mapView}
          scrollEnabled={false}
          zoomEnabled={true}
        />
        {hasPoint ? (
          <TouchableOpacity style={styles.expandButton} onPress={handleOpenDirections}>
            <Ionicons name="navigate" size={16} color="#fff" />
            <Text style={styles.expandButtonText}>{directionsLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      
      <View style={styles.addressContainer}>
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={16} color="#666" />
          <Text style={styles.address}>{getFullAddress()}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 20, borderRadius: 12, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  title: { fontSize: 18, fontWeight: '600', color: '#333', marginLeft: 8 },
  mapContainer: { width: '100%', height: 250, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e0e0e0', position: 'relative' },
  mapView: { flex: 1, backgroundColor: '#f8f9fa' },
  expandButton: { position: 'absolute', bottom: 10, left: 10, backgroundColor: '#0f172a', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  expandButtonText: { color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 4 },
  addressContainer: { marginTop: 12, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 8 },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  address: { fontSize: 14, color: '#666', marginLeft: 8, flex: 1 },
});

export default PropertyMap;
