import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Animated,
  PanResponder,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Property } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import PropertyCard from './PropertyCard';
import { getPriceForDate, getAveragePriceForPeriod } from '../utils/priceCalculator';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_HEIGHT = SCREEN_HEIGHT * 0.5; // Carte prend 50% de l'écran
const BOTTOM_SHEET_MIN_HEIGHT = SCREEN_HEIGHT * 0.5; // Bottom sheet prend l'autre 50%
const BOTTOM_SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.98; // 98% de l'écran max (pour cacher presque complètement la carte et afficher la liste)

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
  const [selectedPropertyPrice, setSelectedPropertyPrice] = useState<number | null>(null);
  const [propertyPrices, setPropertyPrices] = useState<Map<string, number>>(new Map());
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

  // Charger les prix dynamiques pour toutes les propriétés
  useEffect(() => {
    const loadPrices = async () => {
      const pricesMap = new Map<string, number>();
      const today = new Date();
      
      for (const property of properties) {
        try {
          const price = await getPriceForDate(property.id, today, property.price_per_night || 0);
          pricesMap.set(property.id, price);
        } catch (error) {
          console.error(`Error loading price for property ${property.id}:`, error);
          pricesMap.set(property.id, property.price_per_night || 0);
        }
      }
      
      setPropertyPrices(pricesMap);
    };

    if (properties.length > 0) {
      loadPrices();
    }
  }, [properties]);

  // Charger le prix pour la propriété sélectionnée (avec dates si disponibles)
  useEffect(() => {
    const loadSelectedPropertyPrice = async () => {
      if (!selectedProperty) {
        setSelectedPropertyPrice(null);
        return;
      }

      try {
        let price: number;
        
        if (checkIn && checkOut) {
          // Calculer le prix moyen pour la période
          const checkInDate = new Date(checkIn);
          const checkOutDate = new Date(checkOut);
          price = await getAveragePriceForPeriod(
            selectedProperty.id,
            checkInDate,
            checkOutDate,
            selectedProperty.price_per_night || 0
          );
        } else {
          // Utiliser le prix d'aujourd'hui
          const today = new Date();
          price = await getPriceForDate(selectedProperty.id, today, selectedProperty.price_per_night || 0);
        }
        
        setSelectedPropertyPrice(price);
      } catch (error) {
        console.error('Error loading selected property price:', error);
        setSelectedPropertyPrice(selectedProperty.price_per_night || 0);
      }
    };

    loadSelectedPropertyPrice();
  }, [selectedProperty, checkIn, checkOut]);

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
        (p.location?.latitude || p.locations?.latitude || p.latitude) &&
        (p.location?.longitude || p.locations?.longitude || p.longitude)
    );

    if (validProps.length === 0) {
      return {
        center: { lat: 7.5399, lng: -5.5471 },
        bounds: null
      };
    }

    // Calculer les limites (min/max lat/lng)
    const lats = validProps.map(p => p.location?.latitude || p.locations?.latitude || p.latitude || 0);
    const lngs = validProps.map(p => p.location?.longitude || p.locations?.longitude || p.longitude || 0);
    
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
  const createMapHTML = useCallback(() => {
    const validProperties = properties.filter(
      (p) =>
        (p.location?.latitude || p.locations?.latitude || p.latitude) &&
        (p.location?.longitude || p.locations?.longitude || p.longitude)
    );

    const markers = validProperties.map((property) => {
      const lat = property.location?.latitude || property.locations?.latitude || property.latitude || 0;
      const lng = property.location?.longitude || property.locations?.longitude || property.longitude || 0;
      // Utiliser le prix dynamique si disponible, sinon le prix de base
      const price = propertyPrices.get(property.id) || property.price_per_night || 0;
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
    body { margin: 0; padding: 0; background: #f0f0f0; }
    #map { width: 100%; height: 100vh; background: #f0f0f0; }
    .leaflet-container { background: #f0f0f0; }
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
    try {
      var map = L.map('map', {
        zoomControl: true,
        attributionControl: true
      }).setView([${mapBounds.center.lat}, ${mapBounds.center.lng}], 12);
      
      // Ajouter plusieurs sources de tuiles en fallback
      var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      });
      
      var cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
        subdomains: 'abcd'
      });
      
      // Essayer d'ajouter OpenStreetMap d'abord
      osmLayer.addTo(map);
      
      // Si OpenStreetMap échoue, essayer CartoDB
      osmLayer.on('tileerror', function() {
        console.log('OSM tiles failed, trying CartoDB');
        map.removeLayer(osmLayer);
        cartoLayer.addTo(map);
      });
      
    } catch (error) {
      console.error('Error initializing map:', error);
      var mapDiv = document.getElementById('map');
      if (mapDiv) {
        mapDiv.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 16px;">Erreur de chargement de la carte</div>';
      }
    }

    const properties = ${hasMarkers ? `[${markers.join(',\n          ')}]` : '[]'};
    const currentCurrency = '${currency}';
    const currentCurrencySymbol = '${currencySymbol}';

    // Attendre que la carte soit prête avant d'ajouter les marqueurs
    if (typeof map !== 'undefined') {
      map.whenReady(function() {
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
            try {
              const group = new L.featureGroup(markers);
              map.fitBounds(group.getBounds().pad(0.1), {
                maxZoom: 16, // Limiter le zoom max pour ne pas être trop proche
                animate: true
              });
            } catch (boundsError) {
              console.error('Error fitting bounds:', boundsError);
            }
          }
        }
      });
    }
  </script>
</body>
</html>
    `;
  }, [properties, propertyPrices, currency, currencySymbol, convert, mapBounds]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'propertySelected') {
        const property = properties.find((p) => p.id === data.propertyId);
        if (property) {
          setSelectedProperty(property);
          // Faire monter le bottom sheet automatiquement pour afficher la propriété
          Animated.spring(sheetTop, {
            toValue: MAX_TOP,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start();
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const handleClosePropertyView = () => {
    setSelectedProperty(null);
    // Revenir à la position minimale
    Animated.spring(sheetTop, {
      toValue: MIN_TOP,
      useNativeDriver: false,
      tension: 50,
      friction: 7,
    }).start();
  };

  // Positions min et max du bottom sheet
  const MIN_TOP = MAP_HEIGHT;
  const MAX_TOP = SCREEN_HEIGHT - BOTTOM_SHEET_MAX_HEIGHT;

  useEffect(() => {
    // Ne recharger la carte que s'il y a des propriétés
    if (properties.length > 0 && webViewRef.current) {
      webViewRef.current.reload();
    }
  }, [properties, currency, propertyPrices]);
  
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
          key={`map-${properties.length}-${propertyPrices.size}`}
          scrollEnabled={true}
          zoomEnabled={true}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error: ', nativeEvent);
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView HTTP error: ', nativeEvent);
          }}
          onLoadEnd={() => {
            console.log('Map loaded successfully');
          }}
          key={`map-${properties.length}-${propertyPrices.size}`} // Force le rechargement quand le nombre ou les prix changent
        />
      </View>

      {/* Bottom Sheet en bas - doit être visible au-dessus de la carte */}
      <Animated.View style={[styles.bottomSheet, bottomSheetStyle]}>
        {/* Handle */}
        <View {...panResponder.panHandlers} style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {selectedProperty ? (
          <ScrollView 
            style={styles.propertyDetailView}
            showsVerticalScrollIndicator={false}
          >
            {/* Header avec bouton fermer */}
            <View style={styles.propertyDetailHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClosePropertyView}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.favoriteHeaderButton}
                onPress={() => {
                  // TODO: Gérer les favoris
                }}
              >
                <Ionicons name="heart-outline" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Image de la propriété */}
            {selectedProperty.images?.[0] ? (
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: selectedProperty.images[0] }}
                  style={styles.propertyDetailImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {/* Détails de la propriété */}
            <View style={styles.propertyDetailContent}>
              <View style={styles.propertyDetailTitleRow}>
                <Text style={styles.propertyDetailType}>
                  {`${selectedProperty.property_type || 'Logement'} · ${selectedProperty.location?.name || selectedProperty.locations?.name || ''}`}
                </Text>
              </View>
              
              <Text style={styles.propertyDetailTitle} numberOfLines={2}>
                {selectedProperty.title}
              </Text>

              {selectedProperty.rating ? (
                <View style={styles.propertyDetailRating}>
                  <Ionicons name="star" size={18} color="#FFD700" />
                  <Text style={styles.propertyDetailRatingText}>
                    {selectedProperty.rating.toFixed(1)}
                  </Text>
                  {selectedProperty.review_count > 0 ? (
                    <Text style={styles.propertyDetailReviewCount}>
                      ({selectedProperty.review_count})
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {checkIn && checkOut && (
                <View style={styles.propertyDetailDates}>
                  <Ionicons name="calendar-outline" size={16} color="#666" style={{ marginRight: 6 }} />
                  <Text style={styles.propertyDetailDateText}>
                    {`${checkIn} - ${checkOut}`}
                  </Text>
                </View>
              )}

              <View style={styles.propertyDetailPriceContainer}>
                <View style={styles.propertyDetailPrice}>
                  <Text style={styles.propertyDetailPriceAmount}>
                    {formatPrice(selectedPropertyPrice !== null ? selectedPropertyPrice : (selectedProperty.price_per_night || 0))}
                  </Text>
                  <Text style={styles.propertyDetailPriceLabel}>/nuit</Text>
                </View>
              </View>

              {/* Bouton pour voir les détails complets */}
              <TouchableOpacity
                style={styles.viewDetailsButton}
                onPress={() => {
                  if (onPropertyPress) {
                    onPropertyPress(selectedProperty);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.viewDetailsButtonText}>Voir les détails</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <>
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
          </>
        )}
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
  propertyDetailView: {
    flex: 1,
  },
  propertyDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  favoriteHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  propertyDetailImage: {
    width: '100%',
    height: 280,
    backgroundColor: '#f0f0f0',
  },
  propertyDetailContent: {
    padding: 20,
    paddingBottom: 30,
  },
  propertyDetailTitleRow: {
    marginBottom: 10,
  },
  propertyDetailType: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  propertyDetailTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    lineHeight: 30,
  },
  propertyDetailRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  propertyDetailRatingText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginLeft: 6,
  },
  propertyDetailReviewCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  propertyDetailDates: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  propertyDetailDateText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  propertyDetailPriceContainer: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  propertyDetailPrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  propertyDetailPriceAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e74c3c',
  },
  propertyDetailPriceLabel: {
    fontSize: 18,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  viewDetailsButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#e74c3c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  viewDetailsButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default SearchResultsView;

