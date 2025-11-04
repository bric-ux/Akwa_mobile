import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Property } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import PropertyCard from './PropertyCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_HEIGHT = SCREEN_HEIGHT * 0.5; // Carte prend 50% de l'écran
const BOTTOM_SHEET_MIN_HEIGHT = SCREEN_HEIGHT * 0.5; // Bottom sheet prend l'autre 50%
const BOTTOM_SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.75; // 75% de l'écran max (pour laisser un peu de carte visible)

interface SearchResultsViewProps {
  properties: Property[];
  onPropertyPress?: (property: Property) => void;
  location?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}

const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  properties,
  onPropertyPress,
  location,
  checkIn,
  checkOut,
  guests,
}) => {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const webViewRef = useRef<WebView>(null);
  const { formatPrice: formatPriceWithCurrency, currency, currencySymbol, convert } = useCurrency();
  // sheetTop représente directement la position top du bottom sheet (MAP_HEIGHT = position minimale)
  const sheetTop = useRef(new Animated.Value(MAP_HEIGHT)).current;
  
  // Initialiser la position du bottom sheet
  useEffect(() => {
    // S'assurer que le bottom sheet commence visible à MAP_HEIGHT
    sheetTop.setValue(MAP_HEIGHT);
  }, []);
  
  // Réinitialiser la position quand les propriétés changent
  useEffect(() => {
    if (properties.length > 0) {
      sheetTop.setValue(MAP_HEIGHT);
    }
  }, [properties.length]);

  // Calculer les limites (bounds) pour ajuster la vue sur toutes les propriétés
  const getMapBounds = () => {
    if (properties.length === 0) {
      return {
        center: { lat: 7.5399, lng: -5.5471 },
        bounds: null
      };
    }

    const validProps = properties.filter(
      (p) =>
        (p.neighborhoods?.latitude || p.cities?.latitude) &&
        (p.neighborhoods?.longitude || p.cities?.longitude)
    );

    if (validProps.length === 0) {
      return {
        center: { lat: 7.5399, lng: -5.5471 },
        bounds: null
      };
    }

    // Calculer les limites (min/max lat/lng)
    const lats = validProps.map(p => p.neighborhoods?.latitude || p.cities?.latitude || 0);
    const lngs = validProps.map(p => p.neighborhoods?.longitude || p.cities?.longitude || 0);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Centre géographique
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    return {
      center: { lat: centerLat, lng: centerLng },
      bounds: {
        minLat,
        maxLat,
        minLng,
        maxLng
      }
    };
  };

  const mapBounds = getMapBounds();

  const formatPrice = (price: number) => {
    return formatPriceWithCurrency(price);
  };

  // Créer le HTML pour la carte Leaflet avec marqueurs de prix
  const createMapHTML = () => {
    const validProperties = properties.filter(
      (p) =>
        (p.neighborhoods?.latitude || p.cities?.latitude) &&
        (p.neighborhoods?.longitude || p.cities?.longitude)
    );

    const markers = validProperties.map((property) => {
      const lat = property.neighborhoods?.latitude || property.cities?.latitude || 0;
      const lng = property.neighborhoods?.longitude || property.cities?.longitude || 0;
      const price = property.price_per_night || 0;
      const title = property.title || 'Propriété';

      let convertedPrice = price;
      if (currency !== 'XOF') {
        const result = convert(price);
        convertedPrice = result.converted;
      }

      return `{
        position: [${lat}, ${lng}],
        price: ${price},
        convertedPrice: ${convertedPrice},
        title: ${JSON.stringify(title)},
        id: "${property.id}",
        image: "${property.images?.[0] || ''}"
      }`;
    });

    // Si pas de marqueurs, on centre quand même sur la Côte d'Ivoire
    const hasMarkers = markers.length > 0;

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
      background: rgba(255, 255, 255, 0.95);
      border: 1.5px solid #e74c3c;
      border-radius: 16px;
      padding: 6px 12px;
      font-weight: 700;
      font-size: 13px;
      color: #e74c3c;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      cursor: pointer;
      white-space: nowrap;
      backdrop-filter: blur(4px);
    }
    .price-marker:hover {
      background: rgba(231, 76, 60, 0.95);
      color: white;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${mapBounds.center.lat}, ${mapBounds.center.lng}], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    const properties = ${hasMarkers ? `[${markers.join(',\n          ')}]` : '[]'};
    const currentCurrency = '${currency}';
    const currentCurrencySymbol = '${currencySymbol}';

    if (properties.length > 0) {
      // Créer tous les marqueurs
      const markers = [];
      properties.forEach((prop) => {
        const divIcon = L.divIcon({
          className: 'custom-marker',
          html: '<div class="price-marker">' + (
            prop.convertedPrice !== undefined && currentCurrency !== 'XOF'
              ? prop.convertedPrice.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
              : prop.price.toLocaleString('fr-FR')
          ) + ' ' + (
            prop.convertedPrice !== undefined && currentCurrency !== 'XOF' ? currentCurrencySymbol : 'CFA'
          ) + '</div>',
          iconSize: [100, 36],
          iconAnchor: [50, 36]
        });

        const marker = L.marker(prop.position, { 
          icon: divIcon,
          propertyId: prop.id
        }).addTo(map);

        markers.push(marker);

        marker.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'propertySelected',
            propertyId: prop.id
          }));
        });
      });

      // Ajuster la vue pour afficher tous les marqueurs avec un padding
      if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1), {
          maxZoom: 16, // Limiter le zoom max pour ne pas être trop proche
          animate: true
        });
      }
    }
  </script>
</body>
</html>
    `;
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'propertySelected') {
        const property = properties.find((p) => p.id === data.propertyId);
        if (property) {
          setSelectedProperty(property);
          // Scroll to property in list
          const index = properties.findIndex((p) => p.id === property.id);
          if (flatListRef.current && index >= 0) {
            flatListRef.current.scrollToIndex({ index, animated: true });
          }
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  useEffect(() => {
    // Ne recharger la carte que s'il y a des propriétés
    if (properties.length > 0 && webViewRef.current) {
      webViewRef.current.reload();
    }
  }, [properties, currency]);

  // Positions min et max du bottom sheet
  const MIN_TOP = MAP_HEIGHT;
  const MAX_TOP = SCREEN_HEIGHT - BOTTOM_SHEET_MAX_HEIGHT;
  
  // Pan responder pour le bottom sheet
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const currentTop = (sheetTop as any)._value || MAP_HEIGHT;
        sheetTop.setOffset(currentTop);
        sheetTop.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // dy négatif = swipe up = bottom sheet monte (top diminue)
        // dy positif = swipe down = bottom sheet descend (top augmente)
        const newTop = gestureState.dy;
        const clampedValue = Math.max(MAX_TOP - MAP_HEIGHT, Math.min(0, newTop));
        sheetTop.setValue(clampedValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        const offset = (sheetTop as any)._offset || MAP_HEIGHT;
        const currentValue = (sheetTop as any)._value || 0;
        const currentTop = offset + currentValue;
        
        sheetTop.flattenOffset();
        
        let targetTop = MIN_TOP;

        if (gestureState.dy < -50 || gestureState.vy < -0.5) {
          // Swipe up - agrandir le bottom sheet
          targetTop = MAX_TOP;
        } else if (gestureState.dy > 50 || gestureState.vy > 0.5) {
          // Swipe down - réduire le bottom sheet
          targetTop = MIN_TOP;
        } else {
          // Snap to nearest
          const midPoint = (MIN_TOP + MAX_TOP) / 2;
          if (currentTop < midPoint) {
            targetTop = MAX_TOP;
          } else {
            targetTop = MIN_TOP;
          }
        }

        Animated.spring(sheetTop, {
          toValue: targetTop,
          useNativeDriver: false,
          tension: 50,
          friction: 7,
        }).start();
      },
    })
  ).current;

  const flatListRef = useRef<FlatList>(null);

  const renderPropertyCard = ({ item }: { item: Property }) => (
    <PropertyCard property={item} onPress={onPropertyPress || (() => {})} variant="list" />
  );

  const bottomSheetStyle = {
    top: sheetTop,
  };

  // Si pas de propriétés, ne pas afficher la vue avec carte
  if (properties.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Carte en haut */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: createMapHTML() }}
          style={styles.webview}
          scrollEnabled={true}
          zoomEnabled={true}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          key={`map-${properties.length}`} // Force le rechargement quand le nombre change
        />
      </View>

      {/* Bottom Sheet en bas - doit être visible au-dessus de la carte */}
      <Animated.View style={[styles.bottomSheet, bottomSheetStyle]}>
        {/* Handle */}
        <View {...panResponder.panHandlers} style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header du bottom sheet */}
        <View style={styles.bottomSheetHeader}>
          <Text style={styles.resultsCount}>
            {properties.length > 1000
              ? `Plus de ${Math.floor(properties.length / 1000) * 1000} logements`
              : `${properties.length} logement${properties.length > 1 ? 's' : ''}`}
          </Text>
          <View style={styles.sortInfo}>
            <Text style={styles.sortLabel}>Classement des résultats</Text>
            <TouchableOpacity style={styles.infoButton}>
              <Ionicons name="information-circle-outline" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Liste des propriétés */}
        <FlatList
          ref={flatListRef}
          data={properties}
          renderItem={renderPropertyCard}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.propertiesList}
          style={styles.flatList}
          nestedScrollEnabled={true}
          onScrollToIndexFailed={(info) => {
            // Handle scroll to index failure
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToIndex({ index: info.index, animated: true });
              }
            }, 100);
          }}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    height: MAP_HEIGHT,
    width: '100%',
    zIndex: 1,
  },
  webview: {
    flex: 1,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 10,
    overflow: 'hidden',
    minHeight: BOTTOM_SHEET_MIN_HEIGHT,
  },
  handleContainer: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  bottomSheetHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultsCount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sortInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoButton: {
    padding: 4,
  },
  propertiesList: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  flatList: {
    flex: 1,
  },
});

export default SearchResultsView;

