import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

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

/** Relevé de la ville de la diapositive, en haut à droite du carrousel. */
const HomeWeatherChip: React.FC<{ city: string }> = ({ city }) => {
  const navigation = useNavigation();
  const [now, setNow] = useState(new Date());
  const current = WEATHER_CITIES.find((item) => item.city === city);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!current) return null;

  const hour = parseInt(
    now.toLocaleTimeString('fr-FR', { hour: '2-digit', timeZone: 'Africa/Abidjan' }).split(':')[0],
    10,
  );
  const icon = weatherIconName(current.icon, hour) as keyof typeof Ionicons.glyphMap;

  return (
    <TouchableOpacity
      style={styles.chip}
      activeOpacity={0.88}
      onPress={() => (navigation as any).navigate('Search', { destination: current.city })}
      accessibilityRole="button"
      accessibilityLabel={`Météo ${current.city}, ${current.temp} degrés, ${current.condition}`}
    >
      <Ionicons name={icon} size={12} color="#fff" />
      <Text style={styles.title} numberOfLines={1}>
        {current.city} · {current.temp}°
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 3,
    maxWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  title: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
});

export default HomeWeatherChip;
