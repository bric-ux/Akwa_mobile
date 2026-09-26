import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { HOME_EXPLORE_HORIZONTAL_GUTTER } from '../constants/homeExploreLayout';

type WeatherCity = {
  city: string;
  temp: number;
  condition: string;
  icon: 'sunny' | 'cloudy' | 'partly-sunny' | 'rainy';
};

const WEATHER_CITIES: WeatherCity[] = [
  { city: 'Abidjan', temp: 28, condition: 'Ensoleillé', icon: 'sunny' },
  { city: 'Yamoussoukro', temp: 30, condition: 'Nuageux', icon: 'cloudy' },
  { city: 'Bouaké', temp: 27, condition: 'Ensoleillé', icon: 'sunny' },
  { city: 'Korhogo', temp: 29, condition: 'Partiellement nuageux', icon: 'partly-sunny' },
  { city: 'San-Pédro', temp: 26, condition: 'Ensoleillé', icon: 'sunny' },
  { city: 'Man', temp: 25, condition: 'Pluvieux', icon: 'rainy' },
  { city: 'Odienné', temp: 31, condition: 'Ensoleillé', icon: 'sunny' },
  { city: 'Grand-Bassam', temp: 27, condition: 'Ensoleillé', icon: 'sunny' },
  { city: 'Gagnoa', temp: 28, condition: 'Partiellement nuageux', icon: 'partly-sunny' },
  { city: 'Jacqueville', temp: 26, condition: 'Ensoleillé', icon: 'sunny' },
];

const ROTATE_MS = 3500;

function weatherIconName(icon: WeatherCity['icon'], hour: number) {
  const isDay = hour >= 6 && hour < 18;
  switch (icon) {
    case 'sunny':
      return isDay ? 'sunny-outline' : 'moon-outline';
    case 'cloudy':
      return isDay ? 'cloudy-outline' : 'cloudy-night-outline';
    case 'partly-sunny':
      return isDay ? 'partly-sunny-outline' : 'cloudy-night-outline';
    case 'rainy':
      return 'rainy-outline';
    default:
      return isDay ? 'partly-sunny-outline' : 'moon-outline';
  }
}

/** Chip météo compact — alterne les villes CI. */
const HomeWeatherChip: React.FC = () => {
  const navigation = useNavigation();
  const [now, setNow] = useState(new Date());
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => (i + 1) % WEATHER_CITIES.length);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      });
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [opacity]);

  const hour = parseInt(
    now.toLocaleTimeString('fr-FR', { hour: '2-digit', timeZone: 'Africa/Abidjan' }).split(':')[0],
    10,
  );
  const time = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Abidjan',
  });
  const dateLabel = now.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Abidjan',
  });

  const current = WEATHER_CITIES[index];
  const icon = weatherIconName(current.icon, hour) as keyof typeof Ionicons.glyphMap;

  return (
    <TouchableOpacity
      style={styles.chip}
      activeOpacity={0.88}
      onPress={() => (navigation as any).navigate('Search', { destination: current.city })}
      accessibilityRole="button"
      accessibilityLabel={`Météo ${current.city}, ${current.temp} degrés, ${current.condition}`}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={16} color="#64748b" />
      </View>
      <Animated.View style={[styles.textCol, { opacity }]}>
        <Text style={styles.title} numberOfLines={1}>
          {current.city} · {current.temp}°
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {current.condition} · {dateLabel} · {time}
        </Text>
      </Animated.View>
      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    marginHorizontal: HOME_EXPLORE_HORIZONTAL_GUTTER,
    marginTop: 8,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  meta: {
    fontSize: 12,
    color: '#64748b',
  },
});

export default HomeWeatherChip;
