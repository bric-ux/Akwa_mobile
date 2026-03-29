import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image, Modal, Animated, Dimensions, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Property } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { TRAVELER_COLORS, COMMON_COLORS } from '../constants/colors';
import { sanitizePublicDescription } from '../utils/sanitizePublicDescription';

interface SearchMapViewProps {
  properties: Property[];
  onPropertyPress?: (property: Property) => void;
  searchCenter?: { lat: number; lng: number } | null; // Centre de recherche
  searchRadius?: number; // Rayon de recherche en km
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SearchMapView: React.FC<SearchMapViewProps> = ({ properties, onPropertyPress, searchCenter, searchRadius }) => {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const webViewRef = useRef<WebView>(null);
  const { formatPrice: formatPriceWithCurrency, currency, currencySymbol, convert } = useCurrency();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      border: 2px solid ${TRAVELER_COLORS.primary};
      border-radius: 20px;
      padding: 6px 14px;
      font-weight: 800;
      font-size: 13px;
      color: ${TRAVELER_COLORS.primary};
      box-shadow: 0 4px 12px rgba(230, 126, 34, 0.3), 0 2px 4px rgba(0,0,0,0.1);
      cursor: pointer;
      white-space: nowrap;
      backdrop-filter: blur(8px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .price-marker::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
      transition: left 0.5s;
    }
    .price-marker:hover {
      background: linear-gradient(135deg, ${TRAVELER_COLORS.primary} 0%, ${TRAVELER_COLORS.dark} 100%);
      color: white;
      transform: translateY(-2px) scale(1.05);
      box-shadow: 0 6px 20px rgba(230, 126, 34, 0.4), 0 4px 8px rgba(0,0,0,0.15);
    }
    .price-marker:hover::before {
      left: 100%;
    }
    .cluster-marker {
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      border: 2px solid ${TRAVELER_COLORS.primary};
      border-radius: 20px;
      padding: 6px 12px;
      font-weight: 800;
      font-size: 12px;
      color: ${TRAVELER_COLORS.primary};
      box-shadow: 0 4px 12px rgba(230, 126, 34, 0.3), 0 2px 4px rgba(0,0,0,0.1);
      cursor: pointer;
      white-space: nowrap;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 50px;
      position: relative;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(8px);
      line-height: 1.2;
    }
    .cluster-marker::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
      transition: left 0.5s;
    }
    .cluster-marker:hover {
      background: linear-gradient(135deg, ${TRAVELER_COLORS.primary} 0%, ${TRAVELER_COLORS.dark} 100%);
      color: white;
      transform: translateY(-2px) scale(1.05);
      box-shadow: 0 6px 20px rgba(230, 126, 34, 0.4), 0 4px 8px rgba(0,0,0,0.15);
    }
    .cluster-marker:hover::before {
      left: 100%;
    }
    .cluster-count {
      background: ${TRAVELER_COLORS.primary};
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 8px;
      font-size: 11px;
      font-weight: 900;
      box-shadow: 0 2px 6px rgba(230, 126, 34, 0.3);
      border: 2px solid rgba(255, 255, 255, 0.9);
    }
    .property-list-item {
      padding: 12px 14px;
      border-bottom: 1px solid #e8e8e8;
      cursor: pointer;
      transition: all 0.2s ease;
      border-left: 3px solid transparent;
      background: linear-gradient(to right, transparent, rgba(230, 126, 34, 0.02));
    }
    .property-list-item:hover {
      background: linear-gradient(to right, rgba(230, 126, 34, 0.08), rgba(214, 106, 26, 0.05));
      border-left-color: ${TRAVELER_COLORS.primary};
      transform: translateX(4px);
      box-shadow: -2px 0 8px rgba(230, 126, 34, 0.15);
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
        // Calculer le prix min et max pour le cluster
        const prices = markerData.properties.map(p => 
          p.convertedPrice !== undefined && currentCurrency !== 'XOF' ? p.convertedPrice : p.price
        );
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const displayCurrency = markerData.properties[0].convertedPrice !== undefined && currentCurrency !== 'XOF' ? currentCurrencySymbol : 'CFA';
        
        // Si tous les prix sont identiques, afficher un seul prix
        // Sinon, afficher "À partir de X"
        let priceDisplay;
        if (minPrice === maxPrice) {
          priceDisplay = minPrice.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        } else {
          // Afficher "À partir de" avec le prix minimum
          priceDisplay = 'À partir de ' + minPrice.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        }
        
        divIcon = L.divIcon({
          className: 'custom-cluster-marker',
          html: '<div class="cluster-marker">' + priceDisplay + ' ' + displayCurrency + '<span class="cluster-count">' + markerData.count + '</span></div>',
          iconSize: [140, 34],
          iconAnchor: [70, 34]
        });
        
        // Popup avec liste de toutes les propriétés
        // Limiter à 10 propriétés affichées, avec indication si plus
        const maxDisplayed = 10;
        const displayedProperties = markerData.properties.slice(0, maxDisplayed);
        const hasMore = markerData.properties.length > maxDisplayed;
        
        let propertiesList = '';
        displayedProperties.forEach((prop) => {
          const displayPrice = (
            prop.convertedPrice !== undefined && currentCurrency !== 'XOF'
              ? prop.convertedPrice.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
              : prop.price.toLocaleString('fr-FR')
          );
          const displayCurrency = prop.convertedPrice !== undefined && currentCurrency !== 'XOF' ? currentCurrencySymbol : 'CFA';
          const distanceText = prop.distance !== null && prop.distance !== undefined 
            ? ' <span style="color: #888; font-size: 11px; font-weight: 500;">• ' + prop.distance.toFixed(1) + ' km</span>' 
            : '';
          propertiesList += '<div class="property-list-item" onclick="selectProperty(\\'' + prop.id + '\\')">' +
            '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">' +
            '<span style="font-size: 16px;">🏠</span>' +
            '<strong style="font-size: 14px; color: #333; flex: 1; line-height: 1.3;">' + prop.title.replace(/"/g, '') + '</strong>' +
            '</div>' +
            '<div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">' +
            '<span style="color: ${TRAVELER_COLORS.primary}; font-weight: 800; font-size: 13px;">' + displayPrice + ' ' + displayCurrency + '</span>' +
            '<span style="color: #999; font-size: 11px;">/nuit</span>' +
            distanceText +
            '</div>' +
            '</div>';
        });
        
        // Message si plus de propriétés
        const morePropertiesText = hasMore 
          ? '<div style="padding: 12px; text-align: center; color: #666; font-size: 12px; font-weight: 600; border-top: 1px solid #eee;">' +
            'Et ' + (markerData.properties.length - maxDisplayed) + ' autre' + (markerData.properties.length - maxDisplayed > 1 ? 's' : '') + ' propriété' + (markerData.properties.length - maxDisplayed > 1 ? 's' : '') +
            '</div>'
          : '';
        
        popupContent = '<div style="max-width: 300px; max-height: 400px; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;">' +
          '<div style="padding: 14px 16px; background: linear-gradient(135deg, ${TRAVELER_COLORS.primary} 0%, ${TRAVELER_COLORS.dark} 100%); color: white; font-weight: 800; font-size: 15px; box-shadow: 0 4px 12px rgba(230, 126, 34, 0.3); display: flex; align-items: center; gap: 8px; flex-shrink: 0;">' +
          '<span style="font-size: 18px;">📍</span>' +
          '<span>' + markerData.count + ' propriété' + (markerData.count > 1 ? 's' : '') + ' à cet endroit</span>' +
          '</div>' +
          '<div style="padding: 4px; overflow-y: auto; flex: 1; max-height: 320px;">' + propertiesList + '</div>' +
          morePropertiesText +
          '</div>';
      } else {
        // Marqueur simple pour une seule propriété
        const prop = markerData.properties[0];
        const displayPrice = (
          prop.convertedPrice !== undefined && currentCurrency !== 'XOF'
            ? prop.convertedPrice.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
            : prop.price.toLocaleString('fr-FR')
        );
        const displayCurrency = prop.convertedPrice !== undefined && currentCurrency !== 'XOF' ? currentCurrencySymbol : 'CFA';
        divIcon = L.divIcon({
          className: 'custom-marker',
          html: '<div class="price-marker">' + displayPrice + ' ' + displayCurrency + '</div>',
          iconSize: [100, 34],
          iconAnchor: [50, 34]
        });
        
        // Popup pour une seule propriété
        const popupDisplayPrice = (
          prop.convertedPrice !== undefined && currentCurrency !== 'XOF'
            ? (
              prop.convertedPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            )
            : prop.price.toLocaleString('fr-FR')
        );
        const distanceText = prop.distance !== null && prop.distance !== undefined 
          ? '<div style="display: flex; align-items: center; gap: 4px; margin-top: 6px;"><span style="font-size: 12px;">📍</span><span style="color: #888; font-size: 12px; font-weight: 500;">' + prop.distance.toFixed(1) + ' km</span></div>' 
          : '';
        popupContent = '<div style="max-width: 240px; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.15);">' +
          '<div style="padding: 14px 16px; background: linear-gradient(135deg, ${TRAVELER_COLORS.primary} 0%, ${TRAVELER_COLORS.dark} 100%); color: white;">' +
          '<div style="font-size: 18px; font-weight: 800; margin-bottom: 4px;">' + prop.title.replace(/"/g, '') + '</div>' +
          '<div style="display: flex; align-items: baseline; gap: 4px;">' +
          '<span style="font-size: 20px; font-weight: 900;">' + popupDisplayPrice + '</span>' +
          '<span style="font-size: 12px; opacity: 0.9;">' + displayCurrency + '/nuit</span>' +
          '</div>' +
          distanceText +
          '</div>' +
          '<button onclick="selectProperty(\\'' + prop.id + '\\')" style="background: linear-gradient(135deg, ${TRAVELER_COLORS.primary} 0%, ${TRAVELER_COLORS.dark} 100%); color: white; border: none; padding: 12px 20px; border-radius: 0 0 12px 12px; cursor: pointer; width: 100%; font-weight: 700; font-size: 14px; transition: all 0.3s; box-shadow: 0 2px 8px rgba(230, 126, 34, 0.3);">' +
          '✨ Voir détails' +
          '</button>' +
          '</div>';
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
          // Animation d'entrée
          Animated.parallel([
            Animated.spring(slideAnim, {
              toValue: 0,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }),
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start();
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const handleCloseProperty = () => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 300,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedProperty(null);
    });
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
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="map" size={18} color={TRAVELER_COLORS.primary} />
          </View>
          <Text style={styles.headerText}>
            {properties.length === 1 
              ? '1 logement disponible' 
              : `${properties.length} logements disponibles`}
          </Text>
        </View>
      </View>

      {selectedProperty && (
        <>
          {/* Overlay sombre */}
          <Animated.View 
            style={[
              styles.overlay,
              { opacity: fadeAnim }
            ]}
          >
            <TouchableOpacity 
              style={styles.overlayTouchable}
              activeOpacity={1}
              onPress={handleCloseProperty}
            />
          </Animated.View>

          {/* Carte de propriété avec animation */}
          <Animated.View
            style={[
              styles.propertyCard,
              {
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            <ScrollView 
              showsVerticalScrollIndicator={false}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Header avec gradient et image */}
              <View style={styles.cardHeader}>
                {selectedProperty.images?.[0] ? (
                  <Image 
                    source={{ uri: selectedProperty.images[0] }} 
                    style={styles.propertyImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.propertyImagePlaceholder}>
                    <Ionicons name="home" size={48} color={TRAVELER_COLORS.primary} />
                  </View>
                )}
                <View style={styles.imageOverlay} />
                
                {/* Gradient overlay en bas de l'image */}
                <View style={styles.imageGradientOverlay} />
                
                {/* Bouton fermer */}
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleCloseProperty}
                  activeOpacity={0.7}
                >
                  <View style={styles.closeButtonInner}>
                    <Ionicons name="close" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>

                {/* Badge prix flottant avec design amélioré */}
                <View style={styles.priceBadge}>
                  <View style={styles.priceBadgeContent}>
                    <Text style={styles.priceBadgeLabel}>À partir de</Text>
                    <View style={styles.priceBadgeRow}>
                      <Text style={styles.priceBadgeText}>
                        {formatPrice(selectedProperty.price_per_night)}
                      </Text>
                      <Text style={styles.priceBadgeSubtext}>/nuit</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Contenu */}
              <View style={styles.cardContent}>
                {/* Titre avec type de propriété */}
                <View style={styles.titleSection}>
                  {selectedProperty.property_type && (
                    <View style={styles.propertyTypeBadge}>
                      <Text style={styles.propertyTypeText}>{selectedProperty.property_type}</Text>
                    </View>
                  )}
                  <Text style={styles.propertyTitle} numberOfLines={2}>
                    {selectedProperty.title}
                  </Text>
                </View>

                {/* Rating si disponible */}
                {selectedProperty.rating && (
                  <View style={styles.ratingRow}>
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={16} color="#FFD700" />
                      <Text style={styles.ratingText}>{selectedProperty.rating.toFixed(1)}</Text>
                      {selectedProperty.review_count > 0 && (
                        <Text style={styles.reviewCountText}>
                          ({selectedProperty.review_count} avis)
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Informations de localisation */}
                {(selectedProperty.location?.name || selectedProperty.locations?.name) && (
                  <View style={styles.infoRow}>
                    <View style={styles.infoItem}>
                      <View style={styles.infoIconContainer}>
                        <Ionicons name="location" size={18} color={TRAVELER_COLORS.primary} />
                      </View>
                      <Text style={styles.infoText} numberOfLines={2}>
                        {selectedProperty.location?.name || selectedProperty.locations?.name}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Détails supplémentaires avec design amélioré */}
                <View style={styles.detailsRow}>
                  {selectedProperty.bedrooms && (
                    <View style={styles.detailItem}>
                      <View style={styles.detailIconContainer}>
                        <Ionicons name="bed-outline" size={20} color={TRAVELER_COLORS.primary} />
                      </View>
                      <View style={styles.detailTextContainer}>
                        <Text style={styles.detailNumber}>{selectedProperty.bedrooms}</Text>
                        <Text style={styles.detailLabel}>Chambre{selectedProperty.bedrooms > 1 ? 's' : ''}</Text>
                      </View>
                    </View>
                  )}
                  {selectedProperty.bathrooms && (
                    <View style={styles.detailItem}>
                      <View style={styles.detailIconContainer}>
                        <Ionicons name="water-outline" size={20} color={TRAVELER_COLORS.primary} />
                      </View>
                      <View style={styles.detailTextContainer}>
                        <Text style={styles.detailNumber}>{selectedProperty.bathrooms}</Text>
                        <Text style={styles.detailLabel}>Salle{selectedProperty.bathrooms > 1 ? 's' : ''} de bain</Text>
                      </View>
                    </View>
                  )}
                  {selectedProperty.max_guests && (
                    <View style={styles.detailItem}>
                      <View style={styles.detailIconContainer}>
                        <Ionicons name="people-outline" size={20} color={TRAVELER_COLORS.primary} />
                      </View>
                      <View style={styles.detailTextContainer}>
                        <Text style={styles.detailNumber}>{selectedProperty.max_guests}</Text>
                        <Text style={styles.detailLabel}>Voyageur{selectedProperty.max_guests > 1 ? 's' : ''}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Description si disponible */}
                {selectedProperty.description && (
                  <View style={styles.descriptionContainer}>
                    <Text style={styles.description} numberOfLines={3}>
                      {sanitizePublicDescription(selectedProperty.description)}
                    </Text>
                  </View>
                )}

                {/* Bouton d'action principal avec design amélioré */}
                <TouchableOpacity
                  style={styles.viewButton}
                  onPress={() => {
                    if (onPropertyPress) {
                      onPropertyPress(selectedProperty);
                    }
                    handleCloseProperty();
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.viewButtonGradient}>
                    <Text style={styles.viewButtonText}>Voir les détails</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </>
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
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    padding: 12,
    borderRadius: 16,
    shadowColor: TRAVELER_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: `rgba(230, 126, 34, 0.1)`,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `rgba(230, 126, 34, 0.1)`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    letterSpacing: 0.3,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998,
  },
  overlayTouchable: {
    flex: 1,
  },
  propertyCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.75,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  cardHeader: {
    position: 'relative',
    height: 260,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  propertyImage: {
    width: '100%',
    height: '100%',
  },
  propertyImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: TRAVELER_COLORS.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  imageGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'transparent',
    background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  closeButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  priceBadge: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(230, 126, 34, 0.1)',
  },
  priceBadgeContent: {
    padding: 14,
  },
  priceBadgeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  priceBadgeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceBadgeText: {
    fontSize: 24,
    fontWeight: '900',
    color: TRAVELER_COLORS.primary,
  },
  priceBadgeSubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  cardContent: {
    padding: 20,
  },
  titleSection: {
    marginBottom: 12,
  },
  propertyTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: TRAVELER_COLORS.light,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  propertyTypeText: {
    fontSize: 11,
    fontWeight: '700',
    color: TRAVELER_COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  propertyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    lineHeight: 30,
  },
  ratingRow: {
    marginBottom: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  reviewCountText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginLeft: 4,
  },
  infoRow: {
    marginBottom: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TRAVELER_COLORS.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  infoText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
    paddingVertical: 16,
    paddingHorizontal: 4,
    backgroundColor: TRAVELER_COLORS.light,
    borderRadius: 16,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  detailIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: TRAVELER_COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  detailTextContainer: {
    alignItems: 'center',
    gap: 2,
  },
  detailNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  descriptionContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
  },
  viewButton: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: TRAVELER_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  viewButtonGradient: {
    backgroundColor: TRAVELER_COLORS.primary,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  viewButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default SearchMapView;
