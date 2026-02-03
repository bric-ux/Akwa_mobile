import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Vehicle } from '../types';
import { TRAVELER_COLORS } from '../constants/colors';
import { useCurrency } from '../hooks/useCurrency';

interface VehicleMapViewProps {
  vehicles: Vehicle[];
  onVehiclePress?: (vehicleId: string) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  userLocation?: { lat: number; lng: number };
}

const VehicleMapView: React.FC<VehicleMapViewProps> = ({
  vehicles,
  onVehiclePress,
  center = { lat: 5.3600, lng: -4.0083 }, // Abidjan par défaut
  zoom = 12,
  userLocation,
}) => {
  const webViewRef = useRef<WebView>(null);
  const { formatPrice, currency, currencySymbol } = useCurrency();
  const [mapHtml, setMapHtml] = useState('');

  useEffect(() => {
    const createMapHTML = () => {
      const markers: string[] = [];
      
      console.log('🗺️ [VehicleMapView] Création de la carte avec', vehicles.length, 'véhicules');
      
      vehicles.forEach((vehicle) => {
        // Vérifier plusieurs propriétés possibles pour les coordonnées
        // Les véhicules ont location_id qui référence locations avec latitude/longitude
        const lat = vehicle.latitude || vehicle.lat || (vehicle.location as any)?.latitude || null;
        const lng = vehicle.longitude || vehicle.lng || (vehicle.location as any)?.longitude || null;
        
        if (lat && lng) {
          const latNum = parseFloat(lat.toString());
          const lngNum = parseFloat(lng.toString());
          
          if (!isNaN(latNum) && !isNaN(lngNum) && latNum !== 0 && lngNum !== 0) {
            const price = vehicle.price_per_day || 0;
            const formattedPrice = formatPrice(price);
            const vehicleTitle = vehicle.title || `${vehicle.brand || ''} ${vehicle.model || ''}`.trim();
            const vehicleImage = vehicle.images?.[0] || vehicle.vehicle_photos?.[0]?.url || '';
            
            console.log('📍 [VehicleMapView] Ajout marqueur:', vehicleTitle, 'à', latNum, lngNum);
            
            markers.push(`
              {
                lat: ${latNum},
                lng: ${lngNum},
                id: '${vehicle.id}',
                title: ${JSON.stringify(vehicleTitle)},
                price: ${price},
                formattedPrice: ${JSON.stringify(formattedPrice)},
                image: ${JSON.stringify(vehicleImage || '')},
                brand: ${JSON.stringify(vehicle.brand || '')},
                model: ${JSON.stringify(vehicle.model || '')}
              }
            `);
          } else {
            console.log('⚠️ [VehicleMapView] Coordonnées invalides pour véhicule:', vehicle.id, latNum, lngNum);
          }
        } else {
          console.log('⚠️ [VehicleMapView] Pas de coordonnées pour véhicule:', vehicle.id, 'location:', vehicle.location);
        }
      });
      
      console.log('🗺️ [VehicleMapView] Total marqueurs créés:', markers.length);

      const centerLat = center.lat;
      const centerLng = center.lng;
      const zoomLevel = zoom;

      return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; padding: 0; overflow: hidden; }
    #map { width: 100%; height: 100vh; }
    .vehicle-marker {
      background: ${TRAVELER_COLORS.primary};
      color: white;
      border-radius: 20px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(230, 126, 34, 0.4);
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 60px;
    }
    .vehicle-marker:hover {
      background: ${TRAVELER_COLORS.dark};
      transform: scale(1.1);
      z-index: 1000;
    }
    .vehicle-popup {
      max-width: 250px;
    }
    .vehicle-popup-content {
      padding: 0;
    }
    .vehicle-popup-image {
      width: 100%;
      height: 120px;
      object-fit: cover;
      border-radius: 8px 8px 0 0;
    }
    .vehicle-popup-info {
      padding: 12px;
    }
    .vehicle-popup-title {
      font-weight: 700;
      font-size: 14px;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .vehicle-popup-price {
      font-weight: 700;
      font-size: 16px;
      color: ${TRAVELER_COLORS.primary};
      margin-top: 8px;
    }
    .user-location-marker {
      background: #2563eb;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${centerLat}, ${centerLng}], ${zoomLevel});
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    ${userLocation ? `
    // Marqueur position utilisateur
    var userMarker = L.marker([${userLocation.lat}, ${userLocation.lng}], {
      icon: L.divIcon({
        className: 'user-location-marker',
        html: '<div class="user-location-marker"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).addTo(map);
    ` : ''}

    const vehicles = [${markers.join(',\n          ')}];
    
    vehicles.forEach((vehicle) => {
      const marker = L.marker([vehicle.lat, vehicle.lng], {
        icon: L.divIcon({
          className: 'vehicle-marker',
          html: '<div class="vehicle-marker">' + vehicle.formattedPrice + '</div>',
          iconSize: [100, 30],
          iconAnchor: [50, 15]
        })
      }).addTo(map);

      const popupContent = vehicle.image 
        ? '<div class="vehicle-popup-content"><img src="' + vehicle.image + '" class="vehicle-popup-image" /><div class="vehicle-popup-info"><div class="vehicle-popup-title">' + vehicle.title + '</div><div class="vehicle-popup-price">' + vehicle.formattedPrice + ' /jour</div></div></div>'
        : '<div class="vehicle-popup-content"><div class="vehicle-popup-info"><div class="vehicle-popup-title">' + vehicle.title + '</div><div class="vehicle-popup-price">' + vehicle.formattedPrice + ' /jour</div></div></div>';
      
      const popup = L.popup({
        maxWidth: 250,
        className: 'vehicle-popup'
      }).setContent(popupContent);

      marker.bindPopup(popup);
      
      marker.on('click', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'vehicleClick',
            vehicleId: vehicle.id
          }));
        }
      });
    });
  </script>
</body>
</html>
      `;
    };

    setMapHtml(createMapHTML());
  }, [vehicles, center, zoom, userLocation, formatPrice]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'vehicleClick' && onVehiclePress) {
        onVehiclePress(data.vehicleId);
      }
    } catch (error) {
      console.error('Erreur parsing message WebView:', error);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: mapHtml }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default VehicleMapView;

