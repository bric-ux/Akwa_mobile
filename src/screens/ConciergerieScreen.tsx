import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';

const ConciergerieScreen: React.FC = () => {
  const navigation = useNavigation();
  const scrollViewRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    propertyType: '',
    needs: '',
    message: '',
    selectedPlan: '',
  });

  const [revenueData, setRevenueData] = useState({
    currentRevenue: '',
    propertyType: '',
    location: '',
  });

  const [calculatedRevenue, setCalculatedRevenue] = useState<number | null>(null);

  const services = [
    {
      icon: 'home-outline',
      title: 'Gestion complète de propriété',
      description: 'Nous gérons votre bien de A à Z : accueil des voyageurs, ménage, maintenance',
      price: '15% des revenus',
      features: ['Check-in/out 24h', 'Ménage professionnel', 'Maintenance rapide', 'Communication voyageurs'],
    },
    {
      icon: 'camera-outline',
      title: 'Photographie professionnelle',
      description: 'Photos et vidéos haute qualité pour maximiser l\'attractivité de votre annonce',
      price: '150 000 CFA',
      features: ['Photos HD', 'Visite virtuelle 360°', 'Retouche professionnelle', 'Mise en ligne'],
    },
    {
      icon: 'car-outline',
      title: 'Service de transport',
      description: 'Transport personnalisé pour vos hôtes depuis/vers l\'aéroport',
      price: '25 000 CFA/trajet',
      features: ['Véhicules premium', 'Chauffeurs expérimentés', 'Ponctualité garantie', 'Service 24h'],
    },
    {
      icon: 'restaurant-outline',
      title: 'Service traiteur',
      description: 'Repas traditionnels ivoiriens livrés directement à votre propriété',
      price: 'À partir de 8 000 CFA/pers',
      features: ['Cuisine locale authentique', 'Livraison ponctuelle', 'Options végétariennes', 'Service sur mesure'],
    },
    {
      icon: 'calendar-outline',
      title: 'Optimisation des prix',
      description: 'Algorithme intelligent pour maximiser vos revenus selon la demande',
      price: 'Inclus dans la gestion',
      features: ['Analyse de marché', 'Prix dynamiques', 'Rapports détaillés', 'Conseils personnalisés'],
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Assurance premium',
      description: 'Protection complète contre les dommages et incidents',
      price: '50 000 CFA/mois',
      features: ['Couverture 2M CFA', 'Assistance juridique', 'Réparations rapides', 'Support 24h/7j'],
    },
  ];

  const plans = [
    {
      name: 'Essentiel',
      price: '12%',
      description: 'Parfait pour débuter',
      features: [
        'Gestion des réservations',
        'Ménage après chaque séjour',
        'Check-in/out automatisé',
        'Support client de base',
      ],
      popular: false,
    },
    {
      name: 'Premium',
      price: '18%',
      description: 'Le plus populaire',
      features: [
        'Tout de l\'offre Essentiel',
        'Photos professionnelles',
        'Optimisation des prix',
        'Maintenance préventive',
        'Rapport mensuel détaillé',
        'Service de conciergerie',
      ],
      popular: true,
    },
    {
      name: 'Luxe',
      price: '25%',
      description: 'Service haut de gamme',
      features: [
        'Tout de l\'offre Premium',
        'Décoration et staging',
        'Service de transport',
        'Traiteur sur demande',
        'Gestionnaire dédié',
        'Assurance premium incluse',
      ],
      popular: false,
    },
  ];

  const scrollToContact = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const calculateRevenue = () => {
    if (!revenueData.currentRevenue) {
      Alert.alert('Informations manquantes', 'Veuillez entrer vos revenus actuels.');
      return;
    }

    const currentRev = parseFloat(revenueData.currentRevenue);
    const increase = currentRev * 0.65; // 65% d'augmentation
    setCalculatedRevenue(currentRev + increase);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.phone) {
      Alert.alert('Informations manquantes', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }

    try {
      setLoading(true);
      
      // Appeler la fonction edge pour envoyer l'email
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'booking_request',
          to: 'jeanbrice270@gmail.com',
          data: {
            subject: 'Nouvelle demande de consultation - Conciergerie AkwaHome',
            clientName: formData.name,
            clientEmail: formData.email,
            clientPhone: formData.phone,
            propertyType: formData.propertyType,
            selectedPlan: formData.selectedPlan,
            needs: formData.needs,
            message: formData.message,
          },
        },
      });

      if (error) throw error;

      Alert.alert(
        'Demande envoyée !',
        'Notre équipe vous contactera dans les 24h pour discuter de vos besoins.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

      setFormData({
        name: '',
        email: '',
        phone: '',
        propertyType: '',
        needs: '',
        message: '',
        selectedPlan: '',
      });
    } catch (error: any) {
      console.error('Erreur lors de l\'envoi:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'envoi. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conciergerie</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Service Premium 🏆</Text>
            </View>
            <Text style={styles.heroTitle}>
              Service de{'\n'}
              <Text style={styles.heroTitleHighlight}>Conciergerie AkwaHome</Text>
            </Text>
            <Text style={styles.heroDescription}>
              Maximisez vos revenus sans effort ! Notre équipe d'experts gère entièrement votre propriété
              pendant que vous profitez des bénéfices.
            </Text>
            <View style={styles.heroButtons}>
              <TouchableOpacity style={styles.primaryButton} onPress={scrollToContact}>
                <Text style={styles.primaryButtonText}>Démarrer maintenant</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => scrollViewRef.current?.scrollTo({ y: 400, animated: true })}
              >
                <Text style={styles.secondaryButtonText}>Calculer mes revenus</Text>
              </TouchableOpacity>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>+65%</Text>
                <Text style={styles.statLabel}>Revenus supplémentaires</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>24h/7j</Text>
                <Text style={styles.statLabel}>Support disponible</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>98%</Text>
                <Text style={styles.statLabel}>Taux de satisfaction</Text>
              </View>
            </View>
          </View>

          {/* Services Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nos services premium</Text>
            <Text style={styles.sectionSubtitle}>
              Une gamme complète de services pour transformer votre propriété en source de revenus optimale
            </Text>

            {services.map((service, index) => (
              <View key={index} style={styles.serviceCard}>
                <View style={styles.serviceIconContainer}>
                  <Ionicons name={service.icon as any} size={32} color="#e67e22" />
                </View>
                <Text style={styles.serviceTitle}>{service.title}</Text>
                <Text style={styles.serviceDescription}>{service.description}</Text>
                <Text style={styles.servicePrice}>{service.price}</Text>
                <View style={styles.featuresContainer}>
                  {service.features.map((feature, idx) => (
                    <View key={idx} style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* Revenue Calculator */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Calculateur de revenus</Text>
            <Text style={styles.sectionSubtitle}>
              Découvrez combien vous pourriez gagner avec notre service
            </Text>

            <View style={styles.calculatorCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Revenus actuels (CFA/mois)</Text>
                <TextInput
                  style={styles.input}
                  value={revenueData.currentRevenue}
                  onChangeText={(text) => setRevenueData({ ...revenueData, currentRevenue: text })}
                  placeholder="Ex: 500000"
                  keyboardType="numeric"
                />
              </View>

              {calculatedRevenue && (
                <View style={styles.resultContainer}>
                  <Text style={styles.resultLabel}>Revenus estimés avec AkwaHome:</Text>
                  <Text style={styles.resultValue}>
                    {calculatedRevenue.toLocaleString('fr-FR')} CFA/mois
                  </Text>
                  <Text style={styles.resultIncrease}>
                    +{((calculatedRevenue - parseFloat(revenueData.currentRevenue)) / parseFloat(revenueData.currentRevenue) * 100).toFixed(0)}% d'augmentation
                  </Text>
                </View>
              )}

              <TouchableOpacity style={styles.calculateButton} onPress={calculateRevenue}>
                <Text style={styles.calculateButtonText}>Calculer</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Plans Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nos formules</Text>
            <Text style={styles.sectionSubtitle}>Choisissez la formule qui correspond à vos besoins</Text>

            {plans.map((plan, index) => (
              <View
                key={index}
                style={[
                  styles.planCard,
                  plan.popular && styles.planCardPopular,
                ]}
              >
                {plan.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>Le plus populaire</Text>
                  </View>
                )}
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>{plan.price} des revenus</Text>
                <Text style={styles.planDescription}>{plan.description}</Text>
                <View style={styles.planFeatures}>
                  {plan.features.map((feature, idx) => (
                    <View key={idx} style={styles.planFeatureItem}>
                      <Ionicons name="checkmark" size={20} color="#4CAF50" />
                      <Text style={styles.planFeatureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* Contact Form */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contactez-nous</Text>
            <Text style={styles.sectionSubtitle}>
              Remplissez ce formulaire et notre équipe vous contactera dans les 24h
            </Text>

            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nom complet *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Votre nom"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder="votre@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Téléphone *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="+225 XX XX XX XX XX"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Type de propriété</Text>
                <TextInput
                  style={styles.input}
                  value={formData.propertyType}
                  onChangeText={(text) => setFormData({ ...formData, propertyType: text })}
                  placeholder="Appartement, Villa, etc."
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Formule souhaitée</Text>
                <TextInput
                  style={styles.input}
                  value={formData.selectedPlan}
                  onChangeText={(text) => setFormData({ ...formData, selectedPlan: text })}
                  placeholder="Essentiel, Premium, Luxe"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Vos besoins</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.needs}
                  onChangeText={(text) => setFormData({ ...formData, needs: text })}
                  placeholder="Décrivez vos besoins..."
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Message</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.message}
                  onChangeText={(text) => setFormData({ ...formData, message: text })}
                  placeholder="Votre message..."
                  multiline
                  numberOfLines={4}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={20} color="#fff" />
                    <Text style={styles.submitButtonText}>Envoyer la demande</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  badge: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ff9800',
  },
  badgeText: {
    color: '#e67e22',
    fontSize: 12,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroTitleHighlight: {
    color: '#e67e22',
  },
  heroDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#e67e22',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e67e22',
  },
  secondaryButtonText: {
    color: '#e67e22',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e67e22',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  serviceCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  serviceIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#fff3e0',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e67e22',
    marginBottom: 12,
  },
  featuresContainer: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  calculatorCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  resultContainer: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 16,
    marginVertical: 16,
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  resultValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  resultIncrease: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  calculateButton: {
    backgroundColor: '#e67e22',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  planCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e9ecef',
    position: 'relative',
  },
  planCardPopular: {
    borderColor: '#e67e22',
    backgroundColor: '#fff3e0',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: '#e67e22',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e67e22',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  planFeatures: {
    gap: 12,
  },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  planFeatureText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#e67e22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
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

export default ConciergerieScreen;

