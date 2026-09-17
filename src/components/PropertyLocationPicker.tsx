import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import {
  CI_DEFAULT,
  type GeoCoords,
  type MatchedLocation,
  type PreciseLocationResult,
  resolvePreciseLocationFromCoords,
  resolvePreciseLocationFromDevice,
} from '../lib/geolocation';

export type PropertyLocationPickerValue = {
  coords: GeoCoords | null;
  locationLabel: string;
  matchedLocation: MatchedLocation | null;
  addressDetailsSuggestion?: string;
};

type Props = {
  value: PropertyLocationPickerValue;
  onChange: (next: PropertyLocationPickerValue) => void;
  /** Champ localisation texte (CitySearch) — synchro optionnelle */
  onLocationLabelChange?: (label: string) => void;
  height?: number;
};

export default function PropertyLocationPicker({
  value,
  onChange,
  onLocationLabelChange,
  height = 220,
}: Props) {
  const [loading, setLoading] = useState(false);
  const webRef = useRef<WebView>(null);

  const lat = value.coords?.latitude ?? CI_DEFAULT.latitude;
  const lng = value.coords?.longitude ?? CI_DEFAULT.longitude;
  const hasPrecise = Boolean(value.coords);

  const mapHtml = useMemo(
    () => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin:0; padding:0; width:100%; height:100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], ${hasPrecise ? 16 : 12});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(map);
    var marker = L.marker([${lat}, ${lng}], { draggable: true }).addTo(map);
    function emit(lat, lng) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pin', latitude: lat, longitude: lng }));
      }
    }
    marker.on('dragend', function (e) {
      var p = e.target.getLatLng();
      emit(p.lat, p.lng);
    });
    map.on('click', function (e) {
      marker.setLatLng(e.latlng);
      emit(e.latlng.lat, e.latlng.lng);
    });
  </script>
</body>
</html>
  `,
    [lat, lng, hasPrecise],
  );

  const applyResult = (result: PreciseLocationResult) => {
    const next: PropertyLocationPickerValue = {
      coords: result.coords,
      locationLabel: result.addressLabel,
      matchedLocation: result.matchedLocation,
      addressDetailsSuggestion: result.addressDetailsSuggestion,
    };
    onChange(next);
    if (result.addressLabel) onLocationLabelChange?.(result.addressLabel);
  };

  const handleGeolocate = async () => {
    try {
      setLoading(true);
      const result = await resolvePreciseLocationFromDevice();
      applyResult(result);
    } catch (e) {
      Alert.alert(
        'Localisation',
        e instanceof Error
          ? e.message
          : 'Impossible d’obtenir votre position. Vérifiez les autorisations GPS.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePinMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type !== 'pin') return;
      const coords: GeoCoords = {
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
      };
      if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return;
      setLoading(true);
      const result = await resolvePreciseLocationFromCoords(coords);
      applyResult(result);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.geoBtn}
        onPress={handleGeolocate}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={styles.geoBtnText}>Me géolocaliser</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.hint}>
        Placez le pin sur le bâtiment exact (glisser ou toucher la carte). On détecte automatiquement
        la ville / le quartier.
      </Text>

      <View style={[styles.mapBox, { height }]}>
        <WebView
          key={`${lat.toFixed(5)}-${lng.toFixed(5)}`}
          ref={webRef}
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={styles.map}
          onMessage={handlePinMessage}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
        />
        {loading ? (
          <View style={styles.mapOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#e67e22" />
          </View>
        ) : null}
      </View>

      {hasPrecise ? (
        <View style={styles.meta}>
          <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
          <View style={styles.metaText}>
            <Text style={styles.metaTitle}>
              {value.matchedLocation
                ? `${value.matchedLocation.name} (${labelType(value.matchedLocation.type)})`
                : value.locationLabel}
            </Text>
            <Text style={styles.metaCoords}>
              {value.coords!.latitude.toFixed(5)}, {value.coords!.longitude.toFixed(5)}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.help}>
          Ou choisissez d’abord une ville ci-dessus, puis affinez avec le GPS / le pin.
        </Text>
      )}
    </View>
  );
}

function labelType(type: MatchedLocation['type']): string {
  switch (type) {
    case 'neighborhood':
      return 'quartier';
    case 'commune':
      return 'commune';
    case 'city':
      return 'ville';
    case 'region':
      return 'région';
    default:
      return type;
  }
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 4 },
  geoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  geoBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  hint: { marginTop: 8, fontSize: 12, color: '#64748b', lineHeight: 17 },
  mapBox: {
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
  },
  map: { flex: 1, backgroundColor: 'transparent' },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  meta: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  metaText: { flex: 1 },
  metaTitle: { fontSize: 13, fontWeight: '700', color: '#14532d' },
  metaCoords: { marginTop: 2, fontSize: 11, color: '#166534' },
  help: { marginTop: 8, fontSize: 12, color: '#94a3b8' },
});
