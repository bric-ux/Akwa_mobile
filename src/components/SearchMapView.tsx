import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal } from 'react-native';
import { WebView } from 'react-native-webview';
import { Property } from '../types';

interface SearchMapViewProps {
  properties: Property[];
  onPropertyPress?: (property: Property) => void;
}

const SearchMapView: React.FC<SearchMapViewProps> = ({ properties, onPropertyPress }) => {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const webViewRef = useRef<WebView>(null);

  // Calculer les coordonnées moyennes pour centrer la carte
  const getCenterCoordinates = () => {
    if (properties.length === 0) return { lat: 7.5399, lng: -5.5471 }; // Côte d'Ivoire par défaut

    const validProps = properties.filter(p => 
      (p.neighborhoods?.latitude || p.cities?.latitude) && 
      (p.neighborhoods?.longitude || p.cities?.longitude)
    );

    if (validProps.length === 0) return { lat: 7.5399, lng: -5.5471 };

    const lat = validProps.reduce((sum, p) => 
      sum + (p.neighborhoods?.latitude || p.cities?.latitude || 0), 0) / validProps.length;
    
    const lng = validProps.reduce((sum, p) => 
      sum + (p.neighborhoods?.longitude || p.cities?.longitude || 0), 0) / validProps.length;

    return { lat, lng };
  };

  const center = getCenterCoordinates();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(price).replace('XOF', 'FCFA');
  };

  // Créer le HTML pour la carte Leaflet avec marqueurs de prix
  const createMapHTML = () => {
    console.log('🗺️ Création de la carte avec', properties.length, 'propriétés');
    
    const validProperties = properties.filter(p => {
      const hasCoords = (p.neighborhoods?.latitude || p.cities?.latitude) && 
                       (p.neighborhoods?.longitude || p.cities?.longitude);
      if (!hasCoords) {
        console.log('⚠️ Propriété sans coordonnées:', p.title);
      }
      return hasCoords;
    });
    
    console.log('🗺️ Propriétés avec coordonnées:', validProperties.length);
    
    const markers = validProperties.map((property, index) => {
        const lat = property.neighborhoods?.latitude || property.cities?.latitude || 0;
        const lng = property.neighborhoods?.longitude || property.cities?.longitude || 0;
        const price = property.price_per_night || 0;
        const title = property.title || 'Propriété';
        
        console.log(`📍 Marqueur ${index}: ${title} à [${lat}, ${lng}]`);
        
        return `{
          position: [${lat}, ${lng}],
          price: ${price},
          title: ${JSON.stringify(title)},
          id: "${property.id}",
          image: "${property.images?.[0] || ''}"
        }`;
      });

    console.log('🗺️ Markers à afficher:', markers.length);
    console.log('🗺️ Markers data:', markers);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; padding: 0; }
    #map { width: 100%; height: 100vh; }
    .price-marker {
      background: white;
      border: 2px solid #e74c3c;
      border-radius: 20px;
      padding: 6px 12px;
      font-weight: bold;
      font-size: 14px;
      color: #e74c3c;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      cursor: pointer;
      white-space: nowrap;
    }
    .price-marker:hover {
      background: #e74c3c;
      color: white;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${center.lat}, ${center.lng}], 10);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    const properties = [${markers.join(',\n          ')}];
    
    console.log('🗺️ Nombre de propriétés à afficher:', properties.length);

    properties.forEach((prop, index) => {
      console.log('📍 Création du marqueur', index, ':', prop.title, prop.position);
      // Créer une icône personnalisée avec le prix
      const divIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div class="price-marker">' + prop.price.toLocaleString('fr-FR') + ' FCFA</div>',
        iconSize: [120, 40],
        iconAnchor: [60, 40]
      });

      const marker = L.marker(prop.position, { 
        icon: divIcon,
        propertyId: prop.id
      }).addTo(map);

      // Popup au clic
      const popupContent = '<div style="max-width: 200px;"><strong>' + prop.title + '</strong><br/><span style="color: #e74c3c; font-weight: bold; font-size: 16px;">' + prop.price.toLocaleString('fr-FR') + ' FCFA/nuit</span><br/><button onclick="selectProperty(\\'' + prop.id + '\\')" style="background: #e74c3c; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-top: 8px; width: 100%;">Voir détails</button></div>';
      marker.bindPopup(popupContent);

      // Gérer le clic sur le marqueur
      marker.on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'propertySelected',
          propertyId: prop.id
        }));
      });
    });

    // Fonction pour sélectionner une propriété depuis le popup
    window.selectProperty = function(propertyId) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'propertySelected',
        propertyId: propertyId
      }));
    };
  </script>
</body>
</html>
    `;
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'propertySelected') {
        const property = properties.find(p => p.id === data.propertyId);
        if (property) {
          setSelectedProperty(property);
          if (onPropertyPress) {
            onPropertyPress(property);
          }
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: createMapHTML() }}
        style={styles.webview}
        scrollEnabled={true}
        zoomEnabled={true}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
      
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {properties.length} logement{properties.length > 1 ? 's' : ''} disponible{properties.length > 1 ? 's' : ''}
        </Text>
      </View>

      {selectedProperty && (
        <View style={styles.propertyCard}>
          <Text style={styles.propertyTitle}>{selectedProperty.title}</Text>
          <Text style={styles.propertyPrice}>
            {formatPrice(selectedProperty.price_per_night)}/nuit
          </Text>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => {
              if (onPropertyPress) {
                onPropertyPress(selectedProperty);
              }
              setSelectedProperty(null);
            }}
          >
            <Text style={styles.viewButtonText}>Voir les détails</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  propertyCard: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  propertyPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 12,
  },
  viewButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  viewButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SearchMapView;
