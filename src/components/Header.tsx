import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface HeaderProps {
  // Props supprimées - plus de cloche
}

export const Header: React.FC<HeaderProps> = () => {

  return (
    <View style={styles.container}>
      <View style={styles.headerContent}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/images/akwa-home-logo-transparent.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>AkwaHome</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 0, // Supprimer le padding en haut
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginLeft: 10,
  },
});
