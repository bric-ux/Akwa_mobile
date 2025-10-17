import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import LocationTestComponent from '../components/LocationTestComponent';

const LocationTestScreen: React.FC = () => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
      <LocationTestComponent />
    </SafeAreaView>
  );
};

export default LocationTestScreen;


