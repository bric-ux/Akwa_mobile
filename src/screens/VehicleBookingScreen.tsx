import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useVehicles } from '../hooks/useVehicles';
import { useVehicleBookings } from '../hooks/useVehicleBookings';
import { useAuth } from '../services/AuthContext';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import { formatPrice } from '../utils/priceCalculator';
import DateTimePicker from '@react-native-community/datetimepicker';

type VehicleBookingRouteProp = RouteProp<RootStackParamList, 'VehicleBooking'>;

const VehicleBookingScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<VehicleBookingRouteProp>();
  const { vehicleId } = route.params;
  const { user } = useAuth();
  const { getVehicleById } = useVehicles();
  const { createBooking, loading } = useVehicleBookings();
  const { hasUploadedIdentity, isVerified, loading: identityLoading } = useIdentityVerification();

  const [vehicle, setVehicle] = useState<any>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(true);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date(Date.now() + 86400000)); // Demain
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [message, setMessage] = useState('');
  const [hasLicense, setHasLicense] = useState(false);
  const [licenseYears, setLicenseYears] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [useDriver, setUseDriver] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadVehicle = async () => {
      try {
        setLoadingVehicle(true);
        const vehicleData = await getVehicleById(vehicleId);
        setVehicle(vehicleData);
      } catch (error) {
        console.error('Erreur lors du chargement du véhicule:', error);
        Alert.alert('Erreur', 'Impossible de charger les détails du véhicule');
        navigation.goBack();
      } finally {
        setLoadingVehicle(false);
      }
    };

    loadVehicle();
  }, [vehicleId]);

  const requiresLicense = vehicle?.requires_license !== false;
  const minLicenseYears = vehicle?.min_license_years || 0;
  const withDriver = vehicle?.with_driver || false;
  const isLicenseRequired = (!withDriver && requiresLicense) || (withDriver && useDriver === false && requiresLicense);

  const calculateRentalDays = () => {
    if (!startDate || !endDate) return 0;
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 0;
  };

  const rentalDays = calculateRentalDays();
  const dailyRate = vehicle?.price_per_day || 0;
  const totalPrice = dailyRate * rentalDays;
  const securityDeposit = vehicle?.security_deposit || 0;

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour effectuer une réservation');
      return;
    }

    if (identityLoading) {
      Alert.alert('Vérification en cours', 'Vérification de l\'identité en cours...');
      return;
    }

    if (!hasUploadedIdentity) {
      Alert.alert(
        'Vérification d\'identité requise',
        'Vous devez télécharger une pièce d\'identité pour effectuer une réservation. Rendez-vous dans votre profil.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Aller au profil', onPress: () => navigation.navigate('ProfileTab' as never) },
        ]
      );
      return;
    }

    if (!isVerified) {
      Alert.alert(
        'Identité en cours de vérification',
        'Votre pièce d\'identité est en cours de vérification. Vous pourrez réserver une fois qu\'elle sera validée par notre équipe.'
      );
      return;
    }

    if (!startDate || !endDate) {
      Alert.alert('Erreur', 'Veuillez sélectionner les dates de début et de fin');
      return;
    }

    if (rentalDays <= 0) {
      Alert.alert('Erreur', 'La date de fin doit être après la date de début');
      return;
    }

    if (withDriver && useDriver === null) {
      Alert.alert('Choix requis', 'Veuillez indiquer si vous souhaitez utiliser le service de chauffeur ou conduire vous-même.');
      return;
    }

    if (isLicenseRequired) {
      if (!hasLicense) {
        Alert.alert('Permis requis', 'Vous devez posséder un permis de conduire pour réserver ce véhicule.');
        return;
      }
      if (!licenseYears || licenseYears.trim() === '') {
        Alert.alert('Information manquante', 'Veuillez indiquer depuis combien d\'années vous possédez votre permis.');
        return;
      }
      const licenseYearsNum = parseInt(licenseYears);
      if (isNaN(licenseYearsNum) || licenseYearsNum < minLicenseYears) {
        Alert.alert('Permis insuffisant', `Ce véhicule nécessite au moins ${minLicenseYears} an(s) de permis.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const result = await createBooking({
        vehicleId: vehicle.id,
        startDate: startDateStr,
        endDate: endDateStr,
        messageToOwner: message.trim() || undefined,
      });

      if (result.success) {
        Alert.alert(
          'Demande envoyée !',
          'Votre demande de réservation a été envoyée au propriétaire. Vous recevrez une réponse sous peu.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('MyVehicleBookings' as never);
              },
            },
          ]
        );
      } else {
        if (result.error === 'IDENTITY_REQUIRED') {
          Alert.alert(
            'Vérification d\'identité requise',
            'Vous devez télécharger une pièce d\'identité pour effectuer une réservation. Rendez-vous dans votre profil.',
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Aller au profil', onPress: () => navigation.navigate('ProfileTab' as never) },
            ]
          );
        } else if (result.error === 'IDENTITY_NOT_VERIFIED') {
          Alert.alert(
            'Identité en cours de vérification',
            'Votre pièce d\'identité est en cours de vérification. Vous pourrez réserver une fois qu\'elle sera validée par notre équipe.'
          );
        } else {
          Alert.alert('Erreur', result.error || 'Une erreur est survenue lors de l\'envoi de votre demande');
        }
      }
    } catch (error: any) {
      console.error('Erreur lors de la réservation:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'envoi de votre demande');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingVehicle) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Chargement du véhicule...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ccc" />
          <Text style={styles.errorText}>Véhicule introuvable</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const vehicleImage = vehicle.images?.[0] || vehicle.vehicle_photos?.[0]?.url || null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Réservation</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Véhicule */}
        <View style={styles.vehicleCard}>
          {vehicleImage ? (
            <Image source={{ uri: vehicleImage }} style={styles.vehicleImage} resizeMode="cover" />
          ) : (
            <View style={[styles.vehicleImage, styles.vehicleImagePlaceholder]}>
              <Ionicons name="car-outline" size={48} color="#ccc" />
            </View>
          )}
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehicleTitle}>
              {vehicle.title || `${vehicle.brand || ''} ${vehicle.model || ''}`.trim()}
            </Text>
            <Text style={styles.vehiclePrice}>{formatPrice(dailyRate)} / jour</Text>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dates de location</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartPicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#2E7D32" />
              <View style={styles.dateButtonContent}>
                <Text style={styles.dateLabel}>Date de début</Text>
                <Text style={styles.dateValue}>
                  {startDate.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndPicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#2E7D32" />
              <View style={styles.dateButtonContent}>
                <Text style={styles.dateLabel}>Date de fin</Text>
                <Text style={styles.dateValue}>
                  {endDate.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          {rentalDays > 0 && (
            <Text style={styles.rentalDaysText}>
              {rentalDays} jour{rentalDays > 1 ? 's' : ''} de location
            </Text>
          )}
        </View>

        {/* Choix du chauffeur */}
        {withDriver && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service de chauffeur</Text>
            <View style={styles.driverOptions}>
              <TouchableOpacity
                style={[
                  styles.driverOption,
                  useDriver === true && styles.driverOptionActive,
                ]}
                onPress={() => setUseDriver(true)}
              >
                <Ionicons
                  name={useDriver === true ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={useDriver === true ? '#2E7D32' : '#ccc'}
                />
                <Text style={styles.driverOptionText}>Avec chauffeur</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.driverOption,
                  useDriver === false && styles.driverOptionActive,
                ]}
                onPress={() => setUseDriver(false)}
              >
                <Ionicons
                  name={useDriver === false ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={useDriver === false ? '#2E7D32' : '#ccc'}
                />
                <Text style={styles.driverOptionText}>Conduire moi-même</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Permis de conduire */}
        {isLicenseRequired && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Permis de conduire</Text>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setHasLicense(!hasLicense)}
            >
              <Ionicons
                name={hasLicense ? 'checkbox' : 'square-outline'}
                size={24}
                color={hasLicense ? '#2E7D32' : '#ccc'}
              />
              <Text style={styles.checkboxLabel}>Je possède un permis de conduire</Text>
            </TouchableOpacity>
            {hasLicense && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Nombre d'années de permis"
                  value={licenseYears}
                  onChangeText={setLicenseYears}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Numéro de permis (optionnel)"
                  value={licenseNumber}
                  onChangeText={setLicenseNumber}
                />
              </>
            )}
          </View>
        )}

        {/* Message */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Message au propriétaire (optionnel)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Ajoutez un message pour le propriétaire..."
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Résumé */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Résumé</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Prix par jour</Text>
            <Text style={styles.summaryValue}>{formatPrice(dailyRate)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Nombre de jours</Text>
            <Text style={styles.summaryValue}>{rentalDays}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>{formatPrice(totalPrice)}</Text>
          </View>
          {securityDeposit > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Caution</Text>
              <Text style={styles.summaryValue}>{formatPrice(securityDeposit)}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bouton de réservation */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (isSubmitting || loading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting || loading}
        >
          {isSubmitting || loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>Envoyer la demande</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowStartPicker(false);
            if (selectedDate) {
              setStartDate(selectedDate);
              if (selectedDate >= endDate) {
                const newEndDate = new Date(selectedDate);
                newEndDate.setDate(newEndDate.getDate() + 1);
                setEndDate(newEndDate);
              }
            }
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          minimumDate={startDate}
          onChange={(event, selectedDate) => {
            setShowEndPicker(false);
            if (selectedDate) {
              setEndDate(selectedDate);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
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
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 16,
  },
  vehicleImagePlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  vehicleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  vehiclePrice: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  dateButtonContent: {
    marginLeft: 12,
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  rentalDaysText: {
    marginTop: 12,
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
  driverOptions: {
    gap: 12,
  },
  driverOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  driverOptionActive: {
    backgroundColor: '#e8f5e9',
    borderColor: '#2E7D32',
  },
  driverOptionText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkboxLabel: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  textArea: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  summarySection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  summaryTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  summaryTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  submitButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VehicleBookingScreen;

