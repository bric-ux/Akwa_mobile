import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

interface PropertyMapProps {
  latitude?: number;
  longitude?: number;
  locationName?: string;
  cityName?: string;
  neighborhoodName?: string;
}

const PropertyMap: React.FC<PropertyMapProps> = ({
  latitude,
  longitude,
  locationName,
  cityName,
  neighborhoodName,
}) => {
  const defaultLatitude = 7.5399;
  const defaultLongitude = -5.5471;
  
  const mapLatitude = latitude || defaultLatitude;
  const mapLongitude = longitude || defaultLongitude;
  
  console.log('🗺️ Coordonnées de la carte:', { latitude, longitude, mapLatitude, mapLongitude });
  
  const getFullAddress = () => {
    const parts = [];
    if (neighborhoodName) parts.push(neighborhoodName);
    if (cityName) parts.push(cityName);
    if (!parts.length) parts.push('Côte d\'Ivoire');
    return parts.join(', ');
  };

  const handleOpenMap = () => {
    const url = `https://www.openstreetmap.org/?mlat=${mapLatitude}&mlon=${mapLongitude}&zoom=15&layers=M`;
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
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${mapLatitude}, ${mapLongitude}], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        var marker = L.marker([${mapLatitude}, ${mapLongitude}], {
          icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
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
        <Text style={styles.title}>Où vous dormirez</Text>
      </View>
      
      <View style={styles.mapContainer}>
        <WebView
          source={{ html: mapHtml }}
          style={styles.mapView}
          scrollEnabled={false}
          zoomEnabled={true}
        />
        <TouchableOpacity style={styles.expandButton} onPress={handleOpenMap}>
          <Ionicons name="expand" size={16} color="#fff" />
          <Text style={styles.expandButtonText}>Ouvrir en grand</Text>
        </TouchableOpacity>
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
  expandButton: { position: 'absolute', bottom: 10, right: 10, backgroundColor: '#e74c3c', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  expandButtonText: { color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 4 },
  addressContainer: { marginTop: 12, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 8 },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  address: { fontSize: 14, color: '#666', marginLeft: 8, flex: 1 },
});

export default PropertyMap;
