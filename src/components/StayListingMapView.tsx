import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useCurrency } from '../hooks/useCurrency';
import { TRAVELER_COLORS } from '../constants/colors';

export type StayMapMarker = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  price: number;
  priceSuffix?: string;
  image?: string | null;
  subtitle?: string | null;
};

type Props = {
  markers: StayMapMarker[];
  onMarkerPress: (id: string) => void;
  accentColor?: string;
  searchCenter?: { lat: number; lng: number } | null;
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const StayListingMapView: React.FC<Props> = ({
  markers,
  onMarkerPress,
  accentColor = TRAVELER_COLORS.primary,
  searchCenter,
}) => {
  const { formatPrice, currency, currencySymbol, convert } = useCurrency();
  const webViewRef = useRef<WebView>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => markers.find((m) => m.id === selectedId) || null,
    [markers, selectedId],
  );

  const mapHtml = useMemo(() => {
    const valid = markers.filter(
      (m) =>
        Number.isFinite(m.latitude) &&
        Number.isFinite(m.longitude) &&
        m.latitude !== 0 &&
        m.longitude !== 0,
    );

    const payload = valid.map((m) => {
      let displayPrice = m.price;
      if (currency !== 'XOF') {
        displayPrice = convert(m.price).converted;
      }
      return {
        id: m.id,
        lat: m.latitude,
        lng: m.longitude,
        title: (m.title || '').replace(/'/g, '’').replace(/"/g, ''),
        priceLabel: formatPrice(m.price),
        rawPrice: displayPrice,
        suffix: m.priceSuffix || '',
      };
    });

    let centerLat = searchCenter?.lat ?? 7.5399;
    let centerLng = searchCenter?.lng ?? -5.5471;
    if (!searchCenter && payload.length > 0) {
      centerLat = payload.reduce((s, p) => s + p.lat, 0) / payload.length;
      centerLng = payload.reduce((s, p) => s + p.lng, 0) / payload.length;
    }

    const curSym = currency !== 'XOF' ? currencySymbol : 'CFA';

    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  body{margin:0;padding:0;background:#f0f0f0}
  #map{width:100%;height:100vh}
  .leaflet-control-attribution{display:none!important}
  .price-marker{
    background:#fff;border:2px solid ${accentColor};border-radius:20px;
    padding:6px 10px;font-weight:700;font-size:12px;color:#1f2937;
    box-shadow:0 2px 8px rgba(0,0,0,.18);white-space:nowrap
  }
</style>
</head><body>
<div id="map"></div>
<script>
  var items = ${JSON.stringify(payload)};
  var map = L.map('map',{attributionControl:false,zoomControl:true}).setView([${centerLat},${centerLng}],12);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19}).addTo(map);
  var leafletMarkers = [];
  items.forEach(function(item){
    var label = (item.rawPrice||0).toLocaleString('fr-FR',{maximumFractionDigits:0}) + ' ${curSym}';
    var icon = L.divIcon({
      className:'',
      html:'<div class="price-marker">'+label+'</div>',
      iconSize:[90,32],
      iconAnchor:[45,32]
    });
    var marker = L.marker([item.lat,item.lng],{icon:icon}).addTo(map);
    marker.on('click',function(){
      if(window.ReactNativeWebView){
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'select',id:item.id}));
      }
    });
    leafletMarkers.push(marker);
  });
  if(leafletMarkers.length>0){
    try{
      var group=new L.featureGroup(leafletMarkers);
      map.fitBounds(group.getBounds().pad(0.15),{maxZoom:15});
    }catch(e){}
  }
</script>
</body></html>`;
  }, [markers, searchCenter, accentColor, currency, currencySymbol, convert, formatPrice]);

  const onMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'select' && data.id) setSelectedId(data.id);
    } catch {
      /* ignore */
    }
  }, []);

  if (markers.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="map-outline" size={48} color="#ccc" />
        <Text style={styles.emptyText}>Aucune position à afficher sur la carte</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: mapHtml }}
        style={styles.map}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled
        originWhitelist={['*']}
      />
      {selected ? (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardClose}
            onPress={() => setSelectedId(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color="#333" />
          </TouchableOpacity>
          {selected.image ? (
            <Image source={{ uri: selected.image }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImage, styles.cardImageFallback]}>
              <Ionicons name="home-outline" size={28} color="#999" />
            </View>
          )}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {selected.title}
            </Text>
            {selected.subtitle ? (
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {selected.subtitle}
              </Text>
            ) : null}
            <Text style={[styles.cardPrice, { color: accentColor }]}>
              {formatPrice(selected.price)}
              {selected.priceSuffix ? (
                <Text style={styles.cardSuffix}>{selected.priceSuffix}</Text>
              ) : null}
            </Text>
            <TouchableOpacity
              style={[styles.cardBtn, { backgroundColor: accentColor }]}
              onPress={() => onMarkerPress(selected.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.cardBtnText}>Voir les détails</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  map: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  emptyText: { fontSize: 15, color: '#888', textAlign: 'center' },
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    maxHeight: SCREEN_HEIGHT * 0.28,
  },
  cardClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 2,
  },
  cardImage: { width: 110, height: '100%', minHeight: 120 },
  cardImageFallback: {
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, padding: 12, paddingRight: 28, justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  cardSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cardPrice: { fontSize: 16, fontWeight: '800', marginTop: 6 },
  cardSuffix: { fontSize: 12, fontWeight: '500', color: '#6b7280' },
  cardBtn: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cardBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

export default StayListingMapView;
