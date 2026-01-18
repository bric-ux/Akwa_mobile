import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  LinearGradient,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useVehicles } from '../hooks/useVehicles';
import { Vehicle } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../services/AuthContext';
import ContactOwnerButton from '../components/ContactOwnerButton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeGoBack } from '../utils/navigation';
import { VEHICLE_COLORS } from '../constants/colors';

type VehicleDetailsRouteProp = RouteProp<RootStackParamList, 'VehicleDetails'>;

const { width } = Dimensions.get('window');

const VehicleDetailsScreen: React.FC = () => {
  const route = useRoute<VehicleDetailsRouteProp>();
  const navigation = useNavigation();
  const { vehicleId } = route.params;
  const { getVehicleById } = useVehicles();
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const { user } = useAuth();
  
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const loadVehicle = async () => {
      try {
        setLoading(true);
        const vehicleData = await getVehicleById(vehicleId);
        setVehicle(vehicleData);
      } catch (error: any) {
        console.error('Erreur lors du chargement du véhicule:', error);
        Alert.alert('Erreur', 'Impossible de charger les détails du véhicule');
      } finally {
        setLoading(false);
      }
    };

    loadVehicle();
  }, [vehicleId]);

  const handleBookVehicle = () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour réserver un véhicule');
      return;
    }
    navigation.navigate('VehicleBooking' as never, { vehicleId: vehicle.id } as never);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={VEHICLE_COLORS.primary} />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ccc" />
        <Text style={styles.errorText}>Véhicule introuvable</Text>
      </View>
    );
  }

  const isOwner = user?.id === vehicle.owner_id;

  return (
    <View style={styles.safeArea}>
      {/* Header moderne avec gradient */}
      <SafeAreaView style={styles.headerContainer} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => safeGoBack(navigation, 'Vehicles')}
          >
            <View style={styles.backButtonCircle}>
              <Ionicons name="arrow-back" size={20} color="#1a1a1a" />
            </View>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {(() => {
                if (vehicle.title) return String(vehicle.title);
                const parts = [vehicle.brand, vehicle.model].filter(Boolean);
                return parts.length > 0 ? parts.join(' ') : 'Véhicule';
              })()}
            </Text>
          </View>
          <View style={styles.headerPlaceholder} />
        </View>
      </SafeAreaView>

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Images avec overlay gradient */}
        {vehicle.images && vehicle.images.length > 0 && (
          <View style={styles.imageContainer}>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / width);
                setCurrentImageIndex(index);
              }}
              style={styles.imageScrollView}
            >
              {vehicle.images.map((imageUrl, index) => (
                <Image
                  key={index}
                  source={{ uri: imageUrl }}
                  style={styles.mainImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
            {vehicle.images.length > 1 && (
              <View style={styles.imageIndicators}>
                {vehicle.images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.indicator,
                      index === currentImageIndex && styles.activeIndicator,
                    ]}
                  />
                ))}
              </View>
            )}
            {/* Badge nombre de photos */}
            {vehicle.images.length > 1 && (
              <View style={styles.photoCountBadge}>
                <Ionicons name="images" size={14} color="#fff" />
                <Text style={styles.photoCountText}>{String(currentImageIndex + 1)}/{String(vehicle.images.length)}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.content}>
          {/* Titre et prix - Design moderne */}
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>
                  {(() => {
                    const parts = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean);
                    return parts.length > 0 ? parts.join(' ') : 'Véhicule';
                  })()}
                </Text>
                {vehicle.title ? (
                  <Text style={styles.subtitle}>{String(vehicle.title)}</Text>
                ) : null}
              </View>
            </View>
            
            {/* Prix avec design moderne */}
            <View style={styles.priceCard}>
              <View style={styles.priceRow}>
                <View>
                  <Text style={styles.priceLabel}>Prix par jour</Text>
                  <View style={styles.priceValueRow}>
                    <Text style={styles.price}>{formatPrice(vehicle.price_per_day) || '0 FCFA'}</Text>
                    <Text style={styles.priceUnit}>/jour</Text>
                  </View>
                </View>
                {(vehicle.rating > 0) ? (
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={16} color="#FFD700" />
                    <Text style={styles.ratingText}>{vehicle.rating && vehicle.rating > 0 ? String(vehicle.rating.toFixed(1)) : '0.0'}</Text>
                    {(vehicle.review_count || 0) > 0 ? (
                      <Text style={styles.reviewCountText}>({String(vehicle.review_count || 0)})</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
              
              {/* Prix alternatifs */}
              {((vehicle.price_per_week && vehicle.price_per_week > 0) || (vehicle.price_per_month && vehicle.price_per_month > 0)) ? (
                <View style={styles.altPricesRow}>
                  {vehicle.price_per_week && vehicle.price_per_week > 0 ? (
                    <View style={styles.altPriceItem}>
                      <Text style={styles.altPriceValue}>{formatPrice(vehicle.price_per_week) || '0 FCFA'}</Text>
                      <Text style={styles.altPriceLabel}>/semaine</Text>
                    </View>
                  ) : null}
                  {vehicle.price_per_month && vehicle.price_per_month > 0 ? (
                    <View style={styles.altPriceItem}>
                      <Text style={styles.altPriceValue}>{formatPrice(vehicle.price_per_month) || '0 FCFA'}</Text>
                      <Text style={styles.altPriceLabel}>/mois</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            {/* Localisation et note */}
            <View style={styles.metaRow}>
              {vehicle.location ? (
                <View style={styles.metaItem}>
                  <Ionicons name="location" size={16} color={VEHICLE_COLORS.primary} />
                  <Text style={styles.metaText}>{vehicle.location?.name || 'Localisation non spécifiée'}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Réductions disponibles - Design amélioré */}
          {((vehicle.discount_enabled === true) || (vehicle.long_stay_discount_enabled === true)) ? (
            <View style={styles.discountSection}>
              {((vehicle.discount_enabled === true) && vehicle.discount_min_days && vehicle.discount_min_days > 0 && vehicle.discount_percentage) ? (
                <View style={[styles.discountCard, styles.discountCardGreen]}>
                  <View style={styles.discountIconContainer}>
                    <Ionicons name="pricetag" size={20} color="#10b981" />
                  </View>
                  <View style={styles.discountContent}>
                    <Text style={styles.discountTitle}>Réduction disponible</Text>
                    <Text style={styles.discountDescription}>
                      {`${String(vehicle.discount_percentage || 0)}% de réduction à partir de ${String(vehicle.discount_min_days || 0)} jour${((vehicle.discount_min_days || 0) > 1) ? 's' : ''}`}
                    </Text>
                  </View>
                </View>
              ) : null}
              {((vehicle.long_stay_discount_enabled === true) && vehicle.long_stay_discount_min_days && vehicle.long_stay_discount_min_days > 0 && vehicle.long_stay_discount_percentage) ? (
                <View style={[styles.discountCard, styles.discountCardBlue]}>
                  <View style={styles.discountIconContainer}>
                    <Ionicons name="calendar" size={20} color="#3b82f6" />
                  </View>
                  <View style={styles.discountContent}>
                    <Text style={styles.discountTitle}>Réduction longue durée</Text>
                    <Text style={styles.discountDescription}>
                      {`${String(vehicle.long_stay_discount_percentage || 0)}% de réduction à partir de ${String(vehicle.long_stay_discount_min_days || 0)} jour${((vehicle.long_stay_discount_min_days || 0) > 1) ? 's' : ''}`}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Options spéciales - Design moderne */}
          {(((vehicle as any).with_driver === true) || ((vehicle as any).has_insurance === true) || ((vehicle as any).requires_license === true)) ? (
            <View style={styles.optionsSection}>
              <Text style={styles.sectionTitle}>Options & Conditions</Text>
              <View style={styles.optionsGrid}>
                {((vehicle as any).with_driver === true) ? (
                  <View style={styles.optionCard}>
                    <View style={[styles.optionIconContainer, { backgroundColor: '#dbeafe' }]}>
                      <Ionicons name="person" size={24} color="#3b82f6" />
                    </View>
                    <Text style={styles.optionTitle}>Chauffeur</Text>
                    <Text style={styles.optionDescription}>Disponible</Text>
                  </View>
                ) : null}
                {((vehicle as any).has_insurance === true) ? (
                  <View style={styles.optionCard}>
                    <View style={[styles.optionIconContainer, { backgroundColor: '#d1fae5' }]}>
                      <Ionicons name="shield-checkmark" size={24} color="#10b981" />
                    </View>
                    <Text style={styles.optionTitle}>Assuré</Text>
                    {(vehicle as any).insurance_details ? (
                      <Text style={styles.optionDescription} numberOfLines={2}>
                        {String((vehicle as any).insurance_details || '')}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {((vehicle as any).requires_license === true) ? (
                  <View style={styles.optionCard}>
                    <View style={[styles.optionIconContainer, { backgroundColor: '#fef3c7' }]}>
                      <Ionicons name="document-text" size={24} color="#f59e0b" />
                    </View>
                    <Text style={styles.optionTitle}>Permis requis</Text>
                    <Text style={styles.optionDescription} numberOfLines={2}>
                      {((vehicle as any).min_license_years || 0) > 0 
                        ? `${String((vehicle as any).min_license_years || 0)} an(s) minimum`
                        : 'Permis valide requis'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Caractéristiques principales - Design moderne amélioré */}
          <View style={styles.featuresSection}>
            <Text style={styles.sectionTitle}>Caractéristiques</Text>
            <View style={styles.featuresContainer}>
              <View style={styles.featureRow}>
                <View style={styles.featureItem}>
                  <View style={styles.featureIconWrapper}>
                    <Ionicons name="people" size={24} color={VEHICLE_COLORS.primary} />
                  </View>
                  <View style={styles.featureInfo}>
                    <Text style={styles.featureValue}>{String(vehicle.seats || 0)}</Text>
                    <Text style={styles.featureLabel}>Places</Text>
                  </View>
                </View>
                {vehicle.transmission ? (
                  <View style={styles.featureItem}>
                    <View style={styles.featureIconWrapper}>
                      <Ionicons name="settings" size={24} color={VEHICLE_COLORS.primary} />
                    </View>
                    <View style={styles.featureInfo}>
                      <Text style={styles.featureValue}>
                        {vehicle.transmission === 'automatic' ? 'Automatique' : vehicle.transmission === 'manual' ? 'Manuelle' : String(vehicle.transmission || '')}
                      </Text>
                      <Text style={styles.featureLabel}>Transmission</Text>
                    </View>
                  </View>
                ) : null}
              </View>
              <View style={styles.featureRow}>
                {vehicle.fuel_type ? (
                  <View style={styles.featureItem}>
                    <View style={styles.featureIconWrapper}>
                      <Ionicons name="flash" size={24} color={VEHICLE_COLORS.primary} />
                    </View>
                    <View style={styles.featureInfo}>
                      <Text style={styles.featureValue} numberOfLines={1}>
                        {vehicle.fuel_type ? String(vehicle.fuel_type) : 'Non spécifié'}
                      </Text>
                      <Text style={styles.featureLabel}>Carburant</Text>
                    </View>
                  </View>
                ) : null}
                {vehicle.year && vehicle.year > 0 ? (
                  <View style={styles.featureItem}>
                    <View style={styles.featureIconWrapper}>
                      <Ionicons name="calendar" size={24} color={VEHICLE_COLORS.primary} />
                    </View>
                    <View style={styles.featureInfo}>
                      <Text style={styles.featureValue}>{String(vehicle.year)}</Text>
                      <Text style={styles.featureLabel}>Année</Text>
                    </View>
                  </View>
                ) : null}
                {vehicle.mileage && vehicle.mileage > 0 ? (
                  <View style={styles.featureItem}>
                    <View style={styles.featureIconWrapper}>
                      <Ionicons name="speedometer" size={24} color={VEHICLE_COLORS.primary} />
                    </View>
                    <View style={styles.featureInfo}>
                      <Text style={styles.featureValue}>
                        {vehicle.mileage && vehicle.mileage > 0 ? String(vehicle.mileage.toLocaleString('fr-FR')) : '0'}
                      </Text>
                      <Text style={styles.featureLabel}>Kilométrage</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Description */}
          {vehicle.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{String(vehicle.description || '')}</Text>
            </View>
          ) : null}

          {/* Équipements */}
          {vehicle.features && vehicle.features.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Équipements</Text>
              <View style={styles.featuresList}>
                {vehicle.features.map((feature, index) => (
                  <View key={index} style={styles.featureTag}>
                    <Ionicons name="checkmark-circle" size={18} color={VEHICLE_COLORS.primary} />
                    <Text style={styles.featureTagText}>{String(feature || '')}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Règles */}
          {vehicle.rules && vehicle.rules.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Règles de location</Text>
              <View style={styles.rulesList}>
                {vehicle.rules.map((rule, index) => (
                  <View key={index} style={styles.ruleItem}>
                    <Ionicons name="information-circle" size={18} color="#64748b" />
                    <Text style={styles.ruleText}>{String(rule || '')}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Boutons d'action - Design moderne */}
      {!isOwner && (
        <View style={styles.footerContainer}>
          <SafeAreaView style={styles.footerSafeArea} edges={['bottom']}>
            <View style={styles.footer}>
              <View style={styles.contactButtonWrapper}>
                <ContactOwnerButton
                  vehicle={vehicle}
                  variant="outline"
                  size="medium"
                />
              </View>
              <TouchableOpacity
                style={styles.bookButton}
                onPress={handleBookVehicle}
                activeOpacity={0.85}
              >
                <Text style={styles.bookButtonText}>Réserver</Text>
                <Ionicons name="arrow-forward-circle" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    fontWeight: '500',
  },
  headerContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    minHeight: 56,
  },
  backButton: {
    zIndex: 10,
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  headerPlaceholder: {
    width: 40,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imageContainer: {
    width: width,
    height: 280,
    position: 'relative',
    backgroundColor: '#000',
  },
  imageScrollView: {
    width: width,
    height: 280,
  },
  mainImage: {
    width: width,
    height: 280,
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  activeIndicator: {
    backgroundColor: '#fff',
    width: 24,
  },
  photoCountBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  titleSection: {
    marginBottom: 24,
  },
  titleRow: {
    marginBottom: 16,
  },
  titleContainer: {
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  priceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 32,
    fontWeight: '800',
    color: VEHICLE_COLORS.primary,
    letterSpacing: -1,
  },
  priceUnit: {
    fontSize: 16,
    color: '#64748b',
    marginLeft: 6,
    fontWeight: '500',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400e',
  },
  reviewCountText: {
    fontSize: 12,
    color: '#92400e',
    marginLeft: 2,
  },
  altPricesRow: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  altPriceItem: {
    flex: 1,
  },
  altPriceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 2,
  },
  altPriceLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  discountSection: {
    marginBottom: 24,
    gap: 12,
  },
  discountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  discountCardGreen: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  discountCardBlue: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  discountIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountContent: {
    flex: 1,
  },
  discountTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  discountDescription: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  discountText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  optionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  optionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },
  featuresSection: {
    marginBottom: 24,
  },
  featuresContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  featureItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  featureIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureInfo: {
    flex: 1,
  },
  featureValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  featureLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  description: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 24,
  },
  featuresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 6,
  },
  featureTagText: {
    fontSize: 14,
    color: '#166534',
    fontWeight: '500',
  },
  rulesList: {
    gap: 12,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  footerContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  footerSafeArea: {
    backgroundColor: '#fff',
  },
  footer: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'stretch',
    backgroundColor: '#fff',
  },
  contactButtonWrapper: {
    flex: 1,
    minHeight: 60,
    justifyContent: 'center',
  },
  bookButton: {
    flex: 1.5,
    backgroundColor: VEHICLE_COLORS.primary,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    shadowColor: VEHICLE_COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default VehicleDetailsScreen;
