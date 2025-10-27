import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface WeatherData {
  city: string;
  temp: number;
  condition: string;
  icon: string;
}

const WeatherDateTimeWidget: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);

  useEffect(() => {
    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    // Load weather data
    loadWeatherData();

    return () => clearInterval(timer);
  }, []);

  const loadWeatherData = async () => {
    // Mock weather data for capitals
    const mockWeather: WeatherData[] = [
      { city: 'Abidjan', temp: 28, condition: 'Ensoleillé', icon: 'sunny' },
      { city: 'Yamoussoukro', temp: 30, condition: 'Nuageux', icon: 'cloudy' },
      { city: 'Bouaké', temp: 27, condition: 'Ensoleillé', icon: 'sunny' },
      { city: 'Korhogo', temp: 29, condition: 'Partiellement nuageux', icon: 'partly-sunny' },
      { city: 'San-Pédro', temp: 26, condition: 'Ensoleillé', icon: 'sunny' },
      { city: 'Man', temp: 25, condition: 'Pluvieux', icon: 'rainy' },
    ];
    
    setWeatherData(mockWeather);
  };

  const getWeatherIcon = (icon: string) => {
    switch (icon) {
      case 'sunny':
        return 'sunny-outline';
      case 'cloudy':
        return 'cloudy-outline';
      case 'partly-sunny':
        return 'partly-sunny-outline';
      case 'rainy':
        return 'rainy-outline';
      default:
        return 'partly-sunny-outline';
    }
  };

  const formatDate = (date: Date) => {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const day = days[date.getDay()];
    const dayNumber = date.getDate();
    const month = date.getMonth() + 1;
    
    return `${day} ${dayNumber}/${month}`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.widget}>
        {/* Date and Time - Compact */}
        <View style={styles.datetimeSection}>
          <View style={styles.header}>
            <Ionicons name="calendar-outline" size={16} color="#fff" />
            <Text style={styles.dateText}>{formatDate(currentTime)}</Text>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          </View>
        </View>

        {/* Weather Scrollable */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.weatherSection}
          contentContainerStyle={styles.weatherScroll}>
          {weatherData.map((weather, index) => (
            <View key={index} style={styles.weatherCard}>
              <Ionicons 
                name={getWeatherIcon(weather.icon) as any} 
                size={18} 
                color="#e67e22" 
              />
              <Text style={styles.weatherTemp}>{weather.temp}°</Text>
              <Text style={styles.weatherCity}>{weather.city}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  widget: {
    backgroundColor: '#2c3e50',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  datetimeSection: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
    flex: 1,
  },
  timeText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  weatherSection: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  weatherScroll: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  weatherCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 60,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  weatherTemp: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#e67e22',
    marginTop: 4,
  },
  weatherCity: {
    fontSize: 10,
    color: '#6c757d',
    marginTop: 2,
    textAlign: 'center',
  },
});

export default WeatherDateTimeWidget;
