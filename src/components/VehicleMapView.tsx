import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Vehicle } from '../types';
import { TRAVELER_COLORS } from '../constants/colors';
import { useCurrency } from '../hooks/useCurrency';

interface VehicleMapViewProps {
  vehicles: Vehicle[];
  onVehiclePress?: (vehicleId: string) => void;
  onVehicleGroupPress?: (vehicleIds: string[]) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  userLocation?: { lat: number; lng: number };
}

const VehicleMapView: React.FC<VehicleMapViewProps> = ({
  vehicles,
  onVehiclePress,
  onVehicleGroupPress,
  center = { lat: 5.3600, lng: -4.0083 },
  zoom = 12,
  userLocation,
}) => {
  const { formatPrice } = useCurrency();

  const mapHtml = useMemo(() => {
    // Grouper les véhicules par coordonnées
    const vehiclesByLocation = new Map<string, Vehicle[]>();
    
    vehicles.forEach((vehicle) => {
      const lat = (vehicle as any).latitude || (vehicle as any).lat || (vehicle.location as any)?.latitude || null;
      const lng = (vehicle as any).longitude || (vehicle as any).lng || (vehicle.location as any)?.longitude || null;
      
      if (lat && lng) {
        const latNum = parseFloat(lat.toString());
        const lngNum = parseFloat(lng.toString());
        
        if (!isNaN(latNum) && !isNaN(lngNum) && latNum !== 0 && lngNum !== 0) {
          const roundedLat = Math.round(latNum * 10000) / 10000;
          const roundedLng = Math.round(lngNum * 10000) / 10000;
          const locationKey = `${roundedLat},${roundedLng}`;
          
          if (!vehiclesByLocation.has(locationKey)) {
            vehiclesByLocation.set(locationKey, []);
          }
          vehiclesByLocation.get(locationKey)!.push(vehicle);
        }
      }
    });

    // Créer les marqueurs comme dans SearchMapView
    const markers: string[] = [];
    vehiclesByLocation.forEach((vehiclesAtLocation, locationKey) => {
      const [latStr, lngStr] = locationKey.split(',');
      const latNum = parseFloat(latStr);
      const lngNum = parseFloat(lngStr);
      
      const count = vehiclesAtLocation.length;
      const vehicleIds = vehiclesAtLocation.map(v => v.id);
      const vehicleTitles = vehiclesAtLocation.map(v => v.title || `${(v as any).brand || ''} ${(v as any).model || ''}`.trim());
      const vehiclePrices = vehiclesAtLocation.map(v => {
        const price = (v as any).price_per_day || 0;
        return formatPrice(price);
      });
      
      // Créer un objet JavaScript comme chaîne, comme dans SearchMapView
      markers.push(`{
        position: [${latNum}, ${lngNum}],
        count: ${count},
        vehicleIds: ${JSON.stringify(vehicleIds)},
        vehicleTitles: ${JSON.stringify(vehicleTitles)},
        vehiclePrices: ${JSON.stringify(vehiclePrices)}
      }`);
    });

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
    body { margin: 0; padding: 0; }
    #map { width: 100%; height: 100vh; }
    .vehicle-marker {
      background: ${TRAVELER_COLORS.primary};
      color: white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(230, 126, 34, 0.4);
      border: 3px solid white;
      font-size: 20px;
      font-weight: 700;
    }
    .vehicle-marker-count {
      font-size: 12px;
      font-weight: 800;
      margin-top: -2px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    try {
      var map = L.map('map').setView([${centerLat}, ${centerLng}], ${zoomLevel});
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      ${userLocation ? `
      var userMarker = L.marker([${userLocation.lat}, ${userLocation.lng}], {
        icon: L.divIcon({
          className: 'user-location-marker',
          html: '<div style="background: #2563eb; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(map);
      ` : ''}

      const markers = [${markers.length > 0 ? markers.join(',\n          ') : ''}];
      
      markers.forEach(function(markerData) {
        var keyIcon = markerData.count > 1 
          ? '<div class="vehicle-marker">🔑<div class="vehicle-marker-count">' + markerData.count + '</div></div>'
          : '<div class="vehicle-marker">🔑</div>';
        
        var marker = L.marker(markerData.position, {
          icon: L.divIcon({
            className: 'vehicle-marker',
            html: keyIcon,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          })
        }).addTo(map);

        marker.on('click', function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'vehicleGroupClick',
              vehicleIds: markerData.vehicleIds,
              count: markerData.count
            }));
          }
        });
      });


      setTimeout(function() {
        map.invalidateSize();
      }, 200);
    } catch(error) {
      console.error('Erreur carte:', error);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'mapError',
          error: error.toString()
        }));
      }
    }
  </script>
</body>
</html>
    `;
  }, [vehicles, center, zoom, userLocation, formatPrice]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'vehicleGroupClick') {
        if (onVehicleGroupPress && data.vehicleIds) {
          onVehicleGroupPress(data.vehicleIds);
        } else if (onVehiclePress && data.vehicleIds && data.vehicleIds.length > 0) {
          onVehiclePress(data.vehicleIds[0]);
        }
      }
    } catch (error) {
      console.error('❌ [VehicleMapView] Erreur parsing message:', error);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: mapHtml }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={true}
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

