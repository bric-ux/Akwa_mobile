import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useMyProperties } from '../hooks/useMyProperties';
import { useAuth } from '../services/AuthContext';
import { Property } from '../hooks/useProperties';
import { useHostApplications } from '../hooks/useHostApplications';
import { HostApplication } from '../hooks/useHostApplications';
import { useLanguage } from '../contexts/LanguageContext';

type TabType = 'applications' | 'properties';

const MyPropertiesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { getMyProperties, hideProperty, showProperty, deleteProperty, loading } = useMyProperties();
  const { getApplications, loading: applicationsLoading } = useHostApplications();
  const [activeTab, setActiveTab] = useState<TabType>('properties');
  const [properties, setProperties] = useState<Property[]>([]);
  const [applications, setApplications] = useState<HostApplication[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadProperties = async () => {
    try {
      const userProperties = await getMyProperties();
      // Filtrer pour ne garder que les propriétés actives
      const activeProperties = userProperties.filter(p => p.is_active === true);
      setProperties(activeProperties);
    } catch (err) {
      console.error('Erreur lors du chargement des propriétés:', err);
    }
  };

  const loadApplications = async () => {
    try {
      const data = await getApplications();
      setApplications(data);
    } catch (err) {
      console.error('Erreur lors du chargement des candidatures:', err);
    }
  };

  // Charger les données quand l'écran devient actif
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadProperties();
        loadApplications();
      }
    }, [user])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadProperties(), loadApplications()]);
    setRefreshing(false);
  };

  const handleToggleVisibility = async (property: Property) => {
    const action = property.is_active ? t('host.hide') : t('host.show');
    const actionKey = property.is_active ? 'hide' : 'show';
    const newStatus = !property.is_active;

    Alert.alert(
      property.is_active ? t('host.hideProperty') : t('host.showProperty'),
      property.is_active 
        ? t('host.hidePropertyConfirm', { title: property.title })
        : t('host.showPropertyConfirm', { title: property.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: action,
          onPress: async () => {
            try {
              const result = newStatus ? await showProperty(property.id) : await hideProperty(property.id);
              if (result.success) {
                Alert.alert(t('common.success'), property.is_active ? t('host.propertyHidden') : t('host.propertyShown'));
                loadProperties(); // Recharger la liste
              } else {
                Alert.alert(t('common.error'), property.is_active ? t('host.hidePropertyError') : t('host.showPropertyError'));
              }
            } catch (err) {
              Alert.alert(t('common.error'), t('common.errorOccurred'));
            }
          },
        },
      ]
    );
  };

  const handleDeleteProperty = async (property: Property) => {
    Alert.alert(
      t('host.deleteProperty'),
      t('host.deletePropertyConfirm', { title: property.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteProperty(property.id);
              if (result.success) {
                Alert.alert(t('common.success'), t('host.propertyDeleted'));
                loadProperties(); // Recharger la liste
              } else {
                Alert.alert(t('common.error'), t('host.deletePropertyError'));
              }
            } catch (err) {
              Alert.alert(t('common.error'), t('common.errorOccurred'));
            }
          },
        },
      ]
    );
  };

  const handleEditProperty = (propertyId: string) => {
    navigation.navigate('EditProperty', { propertyId });
  };

  const handleViewProperty = (propertyId: string) => {
    navigation.navigate('PropertyManagement', { propertyId } as never);
  };


  const formatPrice = (price: number) => {
    return `${Math.round(price).toLocaleString('fr-FR')} CFA`;
  };

  // Fonction pour obtenir l'URL de la photo principale
  const getMainImageUrl = (property: Property): string => {
    // Priorité 1: property_photos (photos catégorisées) triées par display_order
    if (property.property_photos && Array.isArray(property.property_photos) && property.property_photos.length > 0) {
      const sortedPhotos = [...property.property_photos].sort((a, b) => 
        (a.display_order || 0) - (b.display_order || 0)
      );
      return sortedPhotos[0].url;
    }

    // Priorité 2: images array
    if (property.images && Array.isArray(property.images) && property.images.length > 0) {
      return property.images[0];
    }

    // Fallback: placeholder
    return 'https://via.placeholder.com/150';
  };

  const renderPropertyItem = ({ item: property }: { item: Property }) => (
    <TouchableOpacity
      style={styles.propertyCard}
      onPress={() => handleViewProperty(property.id)}
      activeOpacity={0.7}
    >
      <View style={styles.propertyInfo}>
        <Image
          source={{ uri: getMainImageUrl(property) }}
          style={styles.propertyImage}
          resizeMode="cover"
        />
        <View style={styles.propertyDetails}>
          <Text style={styles.propertyTitle} numberOfLines={1}>{property.title}</Text>
          <Text style={styles.propertyLocation} numberOfLines={1}>
            📍 {property.cities?.name || t('common.unknown')}
          </Text>
          <View style={styles.propertySpecs}>
            <Text style={styles.specText}>👥 {property.max_guests}</Text>
            <Text style={styles.specText}>🛏️ {property.bedrooms}</Text>
            <Text style={styles.specText}>🚿 {property.bathrooms}</Text>
          </View>
          <Text style={styles.propertyPrice}>{formatPrice(property.price_per_night)}/{t('common.perNight')}</Text>
        </View>
      </View>

      <View style={styles.propertyStatus}>
        <View style={[
          styles.statusBadge,
          { backgroundColor: property.is_active ? '#2E7D32' : '#e74c3c' }
        ]}>
          <Text style={styles.statusText}>
            {property.is_active ? t('host.active') : t('host.hidden')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Fonction pour obtenir l'URL de l'image principale d'une candidature
  const getApplicationMainImageUrl = (application: HostApplication): string => {
    if (application.categorized_photos && Array.isArray(application.categorized_photos) && application.categorized_photos.length > 0) {
      const sortedPhotos = [...application.categorized_photos].sort((a, b) => 
        (a.displayOrder || 0) - (b.displayOrder || 0)
      );
      return sortedPhotos[0].url;
    }
    if (application.images && Array.isArray(application.images) && application.images.length > 0) {
      return application.images[0];
    }
    return 'https://via.placeholder.com/150';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#2E7D32';
      case 'reviewing': return '#ffc107';
      case 'rejected': return '#e74c3c';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return t('applications.pending');
      case 'reviewing': return t('applications.reviewing');
      case 'approved': return t('applications.approved');
      case 'rejected': return t('applications.rejected');
      default: return status;
    }
  };

  const renderApplication = (application: HostApplication) => (
    <TouchableOpacity 
      key={application.id} 
      style={styles.applicationCard}
      onPress={() => {
        navigation.navigate('ApplicationDetails' as never, { applicationId: application.id } as never);
      }}
    >
      <Image
        source={{ uri: getApplicationMainImageUrl(application) }}
        style={styles.applicationImage}
        resizeMode="cover"
      />
      <View style={styles.applicationDetails}>
        <Text style={styles.applicationTitle} numberOfLines={1}>
          {application.title}
        </Text>
        <Text style={styles.applicationLocation} numberOfLines={1}>
          📍 {application.location}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(application.status) }]}>
          <Text style={styles.statusText}>
            {getStatusText(application.status)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="home-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>
        {activeTab === 'applications' ? t('host.noApplications') : t('host.noProperties')}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'applications' 
          ? t('host.noApplicationsDesc')
          : t('host.noPropertiesDesc')}
      </Text>
      {activeTab === 'applications' && (
        <TouchableOpacity
          style={styles.becomeHostButton}
          onPress={() => navigation.navigate('BecomeHost')}
        >
          <Text style={styles.becomeHostButtonText}>{t('host.createApplication')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Non connecté</Text>
          <Text style={styles.emptySubtitle}>
            Veuillez vous connecter pour gérer vos propriétés.
          </Text>
          <TouchableOpacity
            style={styles.becomeHostButton}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.becomeHostButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.placeholder} />
        <Text style={styles.headerTitle}>{t('host.properties')}</Text>
        {activeTab === 'applications' && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              console.log('🔵 [MyPropertiesScreen] Navigation vers BecomeHost depuis applications');
              navigation.navigate('BecomeHost' as never);
            }}
          >
            <Ionicons name="add" size={24} color="#2E7D32" />
          </TouchableOpacity>
        )}
        {activeTab === 'properties' && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              console.log('🔵 [MyPropertiesScreen] Navigation vers BecomeHost depuis properties');
              navigation.navigate('BecomeHost' as never);
            }}
          >
            <Ionicons name="add" size={24} color="#2E7D32" />
          </TouchableOpacity>
        )}
      </View>

      {/* Onglets */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'properties' && styles.activeTab]}
          onPress={() => setActiveTab('properties')}
        >
          <Ionicons 
            name="home-outline" 
            size={20} 
            color={activeTab === 'properties' ? '#e67e22' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'properties' && styles.activeTabText]}>
            {t('host.activeProperties')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'applications' && styles.activeTab]}
          onPress={() => setActiveTab('applications')}
        >
          <Ionicons 
            name="document-text-outline" 
            size={20} 
            color={activeTab === 'applications' ? '#e67e22' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'applications' && styles.activeTabText]}>
            {t('host.applications')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenu selon l'onglet actif */}
      {activeTab === 'properties' ? (
        loading && properties.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>{t('host.loadingProperties')}</Text>
          </View>
        ) : properties.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={properties}
            keyExtractor={(item) => item.id}
            renderItem={renderPropertyItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2E7D32']} />
            }
          />
        )
      ) : (
        applicationsLoading && applications.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>{t('host.loadingApplications')}</Text>
          </View>
        ) : applications.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={applications}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderApplication(item)}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2E7D32']} />
            }
          />
        )
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  listContainer: {
    padding: 20,
    flexGrow: 1,
  },
  propertyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  propertyInfo: {
    flexDirection: 'row',
  },
  propertyImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 15,
  },
  propertyDetails: {
    flex: 1,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  propertyLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  propertySpecs: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  specText: {
    fontSize: 12,
    color: '#666',
    marginRight: 15,
  },
  propertyPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  propertyStatus: {
    alignItems: 'flex-end',
    marginTop: 10,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  becomeHostButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  becomeHostButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#e67e22',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#e67e22',
    fontWeight: '600',
  },
  applicationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
  },
  applicationImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 15,
  },
  applicationDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  applicationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  applicationLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
});

export default MyPropertiesScreen;
