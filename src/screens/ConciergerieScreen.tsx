import React, { useState, useRef, useEffect } from 'react';
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
import { useEmailService } from '../hooks/useEmailService';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';

const ConciergerieScreen: React.FC = () => {
  const navigation = useNavigation();
  const scrollViewRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(false);
  const { sendEmail } = useEmailService();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    propertyType: '',
    needs: '',
    message: '',
    selectedPlan: '',
  });

  // Pré-remplir les informations si l'utilisateur est connecté
  useEffect(() => {
    if (user && profile && !profileLoading) {
      const fullName = [profile.first_name, profile.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
      
      setFormData(prev => ({
        ...prev,
        name: fullName || prev.name,
        email: profile.email || prev.email,
        phone: profile.phone || prev.phone,
      }));
    }
  }, [user, profile, profileLoading]);


  const plans = [
    {
      name: 'Basique',
      price: '8%',
      description: 'Pour commencer simplement',
      features: [
        'Gestion des entrées et sorties',
        'Communication avec le voyageur H24',
        'Assure la visibilité des propriétés sur akwahome',
        'Gestion de calendrier',
      ],
      popular: false,
    },
    {
      name: 'Premium',
      price: '18%',
      description: 'Le plus populaire',
      features: [
        'Gestion de Ménage en cours de séjour / après séjour',
        'Tout l\'offre basique',
        'Optimisation des prix',
        'Rapport mensuel détaillé',
      ],
      popular: true,
    },
    {
      name: 'Luxe',
      price: '25%',
      description: 'Service haut de gamme',
      features: [
        'Tout l\'offre Premium',
        'Décoration et staging',
        'Photographie professionnelle',
        'Gestionnaire dédié',
        'Démarche administrative liée à la réglementation',
        'Assistance des voyageurs sur place',
        'Service complémentaire sur devis',
      ],
      popular: false,
    },
  ];

  const scrollToContact = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.phone) {
      Alert.alert('Informations manquantes', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }

    try {
      setLoading(true);
      
      await sendEmail({
        type: 'conciergerie_request',
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
      });

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

          {/* Plans Section */}
          <View style={[styles.section, styles.plansSection]}>
            <Text style={styles.sectionTitle}>Nos formules</Text>
            <Text style={styles.sectionSubtitle}>
              Choisissez la formule qui correspond à vos besoins
            </Text>

            {plans.map((plan, index) => {
              const isSelected = formData.selectedPlan === plan.name;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.planCard,
                    isSelected ? styles.planCardSelected : (plan.popular && !formData.selectedPlan && styles.planCardPopular),
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, selectedPlan: plan.name });
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 300);
                  }}
                  activeOpacity={0.8}
                >
                  {plan.popular && !isSelected && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>Le plus populaire</Text>
                    </View>
                  )}
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>Sélectionnée</Text>
                    </View>
                  )}
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planPrice}>{plan.price} des revenus</Text>
                  <Text style={styles.planDescription}>{plan.description}</Text>
                  <View style={styles.planFeatures}>
                    {plan.features.map((feature, idx) => (
                      <View key={idx} style={styles.planFeatureItem}>
                        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                        <Text style={styles.planFeatureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.planButton,
                      isSelected && styles.planButtonSelected,
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      setFormData({ ...formData, selectedPlan: plan.name });
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 300);
                    }}
                  >
                    <Text style={[
                      styles.planButtonText,
                      isSelected && styles.planButtonTextSelected,
                    ]}>
                      {isSelected ? 'Sélectionnée' : 'Choisir cette formule'}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
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
                <View style={styles.selectedPlanDisplay}>
                  <Text style={formData.selectedPlan ? styles.selectedPlanText : styles.selectedPlanTextEmpty}>
                    {formData.selectedPlan || 'Aucune formule sélectionnée'}
                  </Text>
                  {formData.selectedPlan && (
                    <TouchableOpacity
                      onPress={() => setFormData({ ...formData, selectedPlan: '' })}
                      style={styles.clearPlanButton}
                    >
                      <Ionicons name="close-circle" size={20} color="#666" />
                    </TouchableOpacity>
                  )}
                </View>
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
  plansSection: {
    backgroundColor: '#f8f9fa',
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
  planCardSelected: {
    borderColor: '#e67e22',
    backgroundColor: '#fff3e0',
    shadowColor: '#e67e22',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
  selectedBadge: {
    position: 'absolute',
    top: -12,
    left: 20,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedBadgeText: {
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
  planButton: {
    backgroundColor: '#e9ecef',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  planButtonSelected: {
    backgroundColor: '#e67e22',
  },
  planButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  planButtonTextSelected: {
    color: '#fff',
  },
  selectedPlanDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  selectedPlanText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  selectedPlanTextEmpty: {
    fontSize: 16,
    color: '#999',
    flex: 1,
  },
  clearPlanButton: {
    padding: 4,
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

