import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { supabase } from '../services/supabase';

type PropertyPricingRouteProp = RouteProp<RootStackParamList, 'PropertyPricing'>;

const PropertyPricingScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<PropertyPricingRouteProp>();
  const { propertyId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // État pour la tarification
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountMinNights, setDiscountMinNights] = useState<string>('');
  const [discountPercentage, setDiscountPercentage] = useState<string>('');
  const [longStayDiscountEnabled, setLongStayDiscountEnabled] = useState(false);
  const [longStayDays, setLongStayDays] = useState<string>('40');
  const [longStayDiscountPercentage, setLongStayDiscountPercentage] = useState<string>('');

  useEffect(() => {
    loadProperty();
  }, [propertyId]);

  const loadProperty = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('properties')
        .select('discount_enabled, discount_min_nights, discount_percentage')
        .eq('id', propertyId)
        .single();

      if (error) throw error;

      if (data) {
        setDiscountEnabled(data.discount_enabled || false);
        setDiscountMinNights(data.discount_min_nights?.toString() || '');
        setDiscountPercentage(data.discount_percentage?.toString() || '');
        
        // Pour les séjours longs, on peut utiliser un champ personnalisé ou une logique
        setLongStayDiscountEnabled(false);
        setLongStayDays('40');
        setLongStayDiscountPercentage('');
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la propriété:', error);
      Alert.alert('Erreur', 'Impossible de charger la propriété');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const updates: any = {
        discount_enabled: discountEnabled,
        discount_min_nights: discountMinNights ? parseInt(discountMinNights) : null,
        discount_percentage: discountPercentage ? parseFloat(discountPercentage) : null,
      };

      // Si réduction séjour long activée, utiliser les champs corrects
      if (longStayDiscountEnabled) {
        try {
          updates.long_stay_discount_enabled = true;
          updates.long_stay_discount_min_nights = parseInt(longStayDays);
          updates.long_stay_discount_percentage = parseFloat(longStayDiscountPercentage);
        } catch (e) {
          console.log('Les champs de réduction séjour long ne sont pas disponibles');
        }
      } else {
        updates.long_stay_discount_enabled = false;
        updates.long_stay_discount_min_nights = null;
        updates.long_stay_discount_percentage = null;
      }

      const { error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', propertyId);

      if (error) {
        // Si l'erreur concerne des colonnes inexistantes, on ignore ces champs
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          console.log('Certaines colonnes n\'existent pas encore, sauvegarde des champs disponibles uniquement');
          // Réessayer sans les champs qui n'existent pas
          const safeUpdates: any = {
            discount_enabled: discountEnabled,
            discount_min_nights: discountMinNights ? parseInt(discountMinNights) : null,
            discount_percentage: discountPercentage ? parseFloat(discountPercentage) : null,
          };
          const { error: retryError } = await supabase
            .from('properties')
            .update(safeUpdates)
            .eq('id', propertyId);
          
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      Alert.alert('Succès', 'Les modifications ont été enregistrées');
      navigation.goBack();
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', error.message || 'Impossible de sauvegarder les modifications');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#e67e22" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tarification</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Réduction par nombre de nuits */}
        <View style={styles.section}>
          <View style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <View style={styles.optionHeaderLeft}>
                <Ionicons name="pricetag-outline" size={24} color="#e67e22" />
                <Text style={styles.optionTitle}>Réduction par nombre de nuits</Text>
              </View>
              <Switch
                value={discountEnabled}
                onValueChange={setDiscountEnabled}
                trackColor={{ false: '#ccc', true: '#e67e22' }}
              />
            </View>
            
            {discountEnabled && (
              <View style={styles.optionContent}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nombre minimum de nuits</Text>
                  <TextInput
                    style={styles.input}
                    value={discountMinNights}
                    onChangeText={setDiscountMinNights}
                    placeholder="Ex: 7"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Pourcentage de réduction (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={discountPercentage}
                    onChangeText={setDiscountPercentage}
                    placeholder="Ex: 15"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}
          </View>

          {/* Réduction séjour long */}
          <View style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <View style={styles.optionHeaderLeft}>
                <Ionicons name="calendar-outline" size={24} color="#e67e22" />
                <Text style={styles.optionTitle}>Réduction séjour long</Text>
              </View>
              <Switch
                value={longStayDiscountEnabled}
                onValueChange={setLongStayDiscountEnabled}
                trackColor={{ false: '#ccc', true: '#e67e22' }}
              />
            </View>
            
            {longStayDiscountEnabled && (
              <View style={styles.optionContent}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nombre de jours minimum</Text>
                  <TextInput
                    style={styles.input}
                    value={longStayDays}
                    onChangeText={setLongStayDays}
                    placeholder="Ex: 40"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Pourcentage de réduction (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={longStayDiscountPercentage}
                    onChangeText={setLongStayDiscountPercentage}
                    placeholder="Ex: 20"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
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
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
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
  saveButton: {
    backgroundColor: '#e67e22',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  optionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  optionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  optionContent: {
    marginTop: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
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
});

export default PropertyPricingScreen;

