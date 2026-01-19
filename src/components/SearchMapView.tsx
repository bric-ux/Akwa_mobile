import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image, Modal } from 'react-native';
import { WebView } from 'react-native-webview';
import { Property } from '../types';
import { useCurrency } from '../hooks/useCurrency';

interface SearchMapViewProps {
  properties: Property[];
  onPropertyPress?: (property: Property) => void;
  searchCenter?: { lat: number; lng: number } | null; // Centre de recherche
  searchRadius?: number; // Rayon de recherche en km
}

const SearchMapView: React.FC<SearchMapViewProps> = ({ properties, onPropertyPress, searchCenter, searchRadius }) => {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const webViewRef = useRef<WebView>(null);
  const { formatPrice: formatPriceWithCurrency, currency, currencySymbol, convert } = useCurrency();

  // Calculer les coordonnées moyennes pour centrer la carte
  const getCenterCoordinates = () => {
    // Si on a un centre de recherche, l'utiliser
    if (searchCenter) {
      return searchCenter;
    }
    
    if (properties.length === 0) return { lat: 7.5399, lng: -5.5471 }; // Côte d'Ivoire par défaut

    const validProps = properties.filter(p => 
      (p.location?.latitude || p.locations?.latitude || p.latitude) && 
      (p.location?.longitude || p.locations?.longitude || p.longitude)
    );

    if (validProps.length === 0) return { lat: 7.5399, lng: -5.5471 };

    const lat = validProps.reduce((sum, p) => 
      sum + (p.location?.latitude || p.locations?.latitude || p.latitude || 0), 0) / validProps.length;
    
    const lng = validProps.reduce((sum, p) => 
      sum + (p.location?.longitude || p.locations?.longitude || p.longitude || 0), 0) / validProps.length;

    return { lat, lng };
  };

  const center = getCenterCoordinates();
  
  // Calculer le zoom approprié selon le rayon ou les propriétés
  const getZoomLevel = () => {
    if (searchRadius && searchRadius > 0) {
      // Zoom adapté au rayon (plus le rayon est grand, plus le zoom est faible)
      if (searchRadius <= 5) return 13;
      if (searchRadius <= 10) return 12;
      if (searchRadius <= 20) return 11;
      if (searchRadius <= 50) return 10;
      return 9;
    }
    return 10; // Zoom par défaut
  };

  const formatPrice = (price: number) => {
    return formatPriceWithCurrency(price);
  };

  // Grouper les propriétés par coordonnées (tolérance de 0.0001 degrés ≈ 11 mètres)
  const groupPropertiesByCoordinates = (props: Property[]) => {
    const groups: Map<string, Property[]> = new Map();
    const TOLERANCE = 0.0001; // Environ 11 mètres
    
    props.forEach(property => {
      const lat = property.location?.latitude || property.locations?.latitude || property.latitude || 0;
      const lng = property.location?.longitude || property.locations?.longitude || property.longitude || 0;
      
      // Trouver un groupe existant avec des coordonnées proches
      let foundGroup = false;
      for (const [key, groupProps] of groups.entries()) {
        const [groupLat, groupLng] = key.split(',').map(Number);
        const latDiff = Math.abs(lat - groupLat);
        const lngDiff = Math.abs(lng - groupLng);
        
        if (latDiff < TOLERANCE && lngDiff < TOLERANCE) {
          groupProps.push(property);
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
        groups.set(key, [property]);
      }
    });
    
    return groups;
  };

  // Créer le HTML pour la carte Leaflet avec marqueurs de prix
  const createMapHTML = () => {
    console.log('🗺️ Création de la carte avec', properties.length, 'propriétés');
    console.log('💰 Devise actuelle:', currency, currencySymbol);
    
    const validProperties = properties.filter(p => {
      const hasCoords = (p.location?.latitude || p.locations?.latitude || p.latitude) && 
                       (p.location?.longitude || p.locations?.longitude || p.longitude);
      if (!hasCoords) {
        console.log('⚠️ Propriété sans coordonnées:', p.title, {
          location: p.location,
          locations: p.locations
        });
      }
      return hasCoords;
    });
    
    console.log('🗺️ Propriétés avec coordonnées:', validProperties.length);
    
    // Grouper les propriétés par coordonnées
    const propertyGroups = groupPropertiesByCoordinates(validProperties);
    console.log('📍 Groupes de propriétés:', propertyGroups.size);
    
    // Créer les marqueurs (un par groupe)
    const markers: string[] = [];
    
    propertyGroups.forEach((groupProps) => {
      const firstProp = groupProps[0];
      const lat = firstProp.location?.latitude || firstProp.locations?.latitude || firstProp.latitude || 0;
      const lng = firstProp.location?.longitude || firstProp.locations?.longitude || firstProp.longitude || 0;
      
      // Préparer les données de toutes les propriétés du groupe
      const groupData = groupProps.map(property => {
        const price = property.price_per_night || 0;
        const title = property.title || 'Propriété';
        const distance = property.distance;
        
        let convertedPrice = price;
        if (currency !== 'XOF') {
          const result = convert(price);
          convertedPrice = result.converted;
        }
        
        return {
          id: property.id,
          title: title,
          price: price,
          convertedPrice: convertedPrice,
          image: property.images?.[0] || '',
          distance: distance || null
        };
      });
      
      // Créer un marqueur pour ce groupe
      markers.push(`{
        position: [${lat}, ${lng}],
        count: ${groupProps.length},
        properties: ${JSON.stringify(groupData)}
      }`);
    });

    console.log('🗺️ Markers à afficher:', markers.length);
    console.log('💰 Devise pour HTML:', currency, currencySymbol);
    
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
      background: rgba(255, 255, 255, 0.85);
      border: 1.5px solid #e74c3c;
      border-radius: 16px;
      padding: 4px 10px;
      font-weight: 700;
      font-size: 12px;
      color: #e74c3c;
      box-shadow: 0 2px 6px rgba(0,0,0,0.12);
      cursor: pointer;
      white-space: nowrap;
      backdrop-filter: blur(2px);
    }
    .price-marker:hover {
      background: rgba(231, 76, 60, 0.9);
      color:white;
    }
    .cluster-marker {
      background: rgba(46, 125, 50, 0.95);
      border: 2px solid #2E7D32;
      border-radius: 20px;
      padding: 8px 14px;
      font-weight: 700;
      font-size: 14px;
      color: white;
      box-shadow: 0 3px 10px rgba(0,0,0,0.2);
      cursor: pointer;
      white-space: nowrap;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 50px;
    }
    .cluster-marker:hover {
      background: rgba(46, 125, 50, 1);
      transform: scale(1.05);
    }
    .cluster-count {
      background: white;
      color: #2E7D32;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 6px;
      font-size: 12px;
      font-weight: 800;
    }
    .property-list-item {
      padding: 10px;
      border-bottom: 1px solid #eee;
      cursor: pointer;
    }
    .property-list-item:hover {
      background: #f5f5f5;
    }
    .property-list-item:last-child {
      border-bottom: none;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${center.lat}, ${center.lng}], ${getZoomLevel()});
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Ajouter le centre de recherche et le cercle de rayon si disponible
    ${searchCenter && searchRadius ? `
    // Marqueur pour le centre de recherche
    var searchCenterMarker = L.marker([${searchCenter.lat}, ${searchCenter.lng}], {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(map);
    searchCenterMarker.bindPopup('<strong>📍 Centre de recherche</strong><br/>Rayon: ${searchRadius} km');
    
    // Cercle pour le rayon de recherche
    var radiusCircle = L.circle([${searchCenter.lat}, ${searchCenter.lng}], {
      radius: ${searchRadius * 1000}, // Convertir km en mètres
      color: '#2E7D32',
      fillColor: '#4CAF50',
      fillOpacity: 0.1,
      weight: 2,
      dashArray: '5, 5'
    }).addTo(map);
    ` : ''}

    const markers = [${markers.join(',\n          ')}];
    const currentCurrency = '${currency}';
    const currentCurrencySymbol = '${currencySymbol}';
    
    console.log('🗺️ Nombre de marqueurs à afficher:', markers.length);
    console.log('💰 Devise dans le navigateur:', currentCurrency, currentCurrencySymbol);

    markers.forEach((markerData, index) => {
      const isCluster = markerData.count > 1;
      
      let divIcon;
      let popupContent;
      
      if (isCluster) {
        // Marqueur de cluster avec compteur
        divIcon = L.divIcon({
          className: 'custom-cluster-marker',
          html: '<div class="cluster-marker">' + 
            (markerData.properties[0].convertedPrice !== undefined && currentCurrency !== 'XOF'
              ? markerData.properties[0].convertedPrice.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
              : markerData.properties[0].price.toLocaleString('fr-FR')
            ) + ' ' + (
              markerData.properties[0].convertedPrice !== undefined && currentCurrency !== 'XOF' ? currentCurrencySymbol : 'CFA'
            ) + '<span class="cluster-count">' + markerData.count + '</span></div>',
          iconSize: [120, 40],
          iconAnchor: [60, 40]
        });
        
        // Popup avec liste de toutes les propriétés
        let propertiesList = '';
        markerData.properties.forEach((prop, idx) => {
          const displayPrice = (
            prop.convertedPrice !== undefined && currentCurrency !== 'XOF'
              ? prop.convertedPrice.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
              : prop.price.toLocaleString('fr-FR')
          );
          const displayCurrency = prop.convertedPrice !== undefined && currentCurrency !== 'XOF' ? currentCurrencySymbol : 'CFA';
          const distanceText = prop.distance !== null && prop.distance !== undefined 
            ? ' <span style="color: #666; font-size: 11px;">(' + prop.distance.toFixed(1) + ' km)</span>' 
            : '';
          propertiesList += '<div class="property-list-item" onclick="selectProperty(\\'' + prop.id + '\\')">' +
            '<strong style="font-size: 13px;">' + prop.title.replace(/"/g, '') + '</strong><br/>' +
            '<span style="color: #e74c3c; font-weight: bold; font-size: 12px;">' + displayPrice + ' ' + displayCurrency + '/nuit</span>' + distanceText +
            '</div>';
        });
        
        popupContent = '<div style="max-width: 250px; max-height: 300px; overflow-y: auto;">' +
          '<div style="padding: 8px; background: #2E7D32; color: white; font-weight: bold; margin: -10px -10px 10px -10px; border-radius: 4px 4px 0 0;">' +
          markerData.count + ' propriété' + (markerData.count > 1 ? 's' : '') + ' à cet endroit' +
          '</div>' +
          propertiesList +
          '</div>';
      } else {
        // Marqueur simple pour une seule propriété
        const prop = markerData.properties[0];
        divIcon = L.divIcon({
          className: 'custom-marker',
          html: '<div class="price-marker">' + (
            prop.convertedPrice !== undefined && currentCurrency !== 'XOF'
              ? prop.convertedPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : prop.price.toLocaleString('fr-FR')
          ) + ' ' + (
            prop.convertedPrice !== undefined && currentCurrency !== 'XOF' ? currentCurrencySymbol : 'CFA'
          ) + '</div>',
          iconSize: [90, 34],
          iconAnchor: [45, 34]
        });
        
        // Popup pour une seule propriété
        const displayPrice = (
          prop.convertedPrice !== undefined && currentCurrency !== 'XOF'
            ? (
              currentCurrency !== 'JPY'
                ? prop.convertedPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : Math.round(prop.convertedPrice).toLocaleString('fr-FR')
            )
            : prop.price.toLocaleString('fr-FR')
        );
        const displayCurrency = prop.convertedPrice !== undefined && currentCurrency !== 'XOF' ? currentCurrencySymbol : 'CFA';
        const distanceText = prop.distance !== null && prop.distance !== undefined 
          ? '<br/><span style="color: #666; font-size: 12px;">📍 ' + prop.distance.toFixed(1) + ' km</span>' 
          : '';
        popupContent = '<div style="max-width: 200px;"><strong>' + prop.title.replace(/"/g, '') + '</strong><br/><span style="color: #e74c3c; font-weight: bold; font-size: 16px;">' + displayPrice + ' ' + displayCurrency + '/nuit</span>' + distanceText + '<br/><button onclick="selectProperty(\\'' + prop.id + '\\')" style="background: #e74c3c; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-top: 8px; width: 100%;">Voir détails</button></div>';
      }

      const marker = L.marker(markerData.position, { 
        icon: divIcon
      }).addTo(map);

      marker.bindPopup(popupContent);

      // Gérer le clic sur le marqueur
      marker.on('click', function() {
        // Si c'est un cluster, ne pas sélectionner automatiquement
        // L'utilisateur doit choisir dans le popup
        if (!isCluster && markerData.properties[0]) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'propertySelected',
            propertyId: markerData.properties[0].id
          }));
        }
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
          // Afficher seulement l'aperçu, ne pas naviguer directement
          setSelectedProperty(property);
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  useEffect(() => {
    console.log('🔄 Propriétés, devise, centre ou rayon ont changé, rechargement de la carte');
    console.log('💰 Devise actuelle:', currency);
    console.log('📍 Centre de recherche:', searchCenter);
    console.log('📏 Rayon de recherche:', searchRadius);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  }, [properties, currency, searchCenter, searchRadius]);

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
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedProperty(null)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          {selectedProperty.images?.[0] && (
            <Image 
              source={{ uri: selectedProperty.images[0] }} 
              style={styles.propertyImage}
              resizeMode="cover"
            />
          )}
          <Text style={styles.propertyTitle}>{selectedProperty.title}</Text>
          <Text style={styles.propertyPrice}>
            {formatPrice(selectedProperty.price_per_night)}/nuit
          </Text>
          {(selectedProperty.location?.name || selectedProperty.locations?.name) && (
            <Text style={styles.propertyLocation}>
              📍 {selectedProperty.location?.name || selectedProperty.locations?.name}
            </Text>
          )}
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
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
propertyImage: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    marginBottom: 8,
  },
  propertyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  propertyPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 4,
  },
  propertyLocation: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  viewButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  viewButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SearchMapView;
