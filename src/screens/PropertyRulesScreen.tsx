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

type PropertyRulesRouteProp = RouteProp<RootStackParamList, 'PropertyRules'>;

const PropertyRulesScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<PropertyRulesRouteProp>();
  const { propertyId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // État pour le règlement intérieur
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('11:00');
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [eventsAllowed, setEventsAllowed] = useState(false);
  const [otherRules, setOtherRules] = useState('');

  useEffect(() => {
    loadProperty();
  }, [propertyId]);

  const loadProperty = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('properties')
        .select('check_in_time, check_out_time, house_rules')
        .eq('id', propertyId)
        .single();

      if (error) {
        // Si les colonnes n'existent pas encore, on utilise les valeurs par défaut
        console.log('Certains champs de règlement intérieur ne sont pas disponibles');
      }

      if (data) {
        // Formater les horaires pour n'afficher que HH:MM (sans secondes)
        const formatTime = (time: string | null | undefined): string => {
          if (!time) return '14:00';
          // Si le format est HH:MM:SS, ne garder que HH:MM
          if (time.includes(':')) {
            const parts = time.split(':');
            return `${parts[0]}:${parts[1]}`;
          }
          return time;
        };
        
        setCheckInTime(formatTime(data.check_in_time));
        setCheckOutTime(formatTime(data.check_out_time));
        
        // Parser les règles depuis house_rules (comme sur le web)
        const rules = data.house_rules || '';
        setPetsAllowed(rules.includes('Animaux autorisés'));
        setSmokingAllowed(rules.includes('Fumer autorisé'));
        setEventsAllowed(rules.includes('Événements autorisés'));
        
        // Extraire les autres règles (tout ce qui n'est pas dans les règles prédéfinies)
        const ruleLines = rules.split('\n').filter((line: string) => 
          !line.includes('Animaux autorisés') && 
          !line.includes('Fumer autorisé') && 
          !line.includes('Événements autorisés') &&
          line.trim() !== ''
        );
        setOtherRules(ruleLines.join('\n'));
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la propriété:', error);
      // On continue avec les valeurs par défaut
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Construire house_rules comme sur le web (chaîne avec sauts de ligne)
      const updates: any = {
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        house_rules: [
          petsAllowed && 'Animaux autorisés',
          smokingAllowed && 'Fumer autorisé',
          eventsAllowed && 'Événements autorisés',
          otherRules
        ].filter(Boolean).join('\n'),
      };

      const { error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', propertyId);

      if (error) {
        // Si l'erreur concerne des colonnes inexistantes, on informe l'utilisateur
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          Alert.alert(
            'Information',
            'Certains champs ne sont pas encore disponibles dans la base de données. Les modifications seront enregistrées lorsque ces champs seront créés.'
          );
        } else {
          throw error;
        }
      } else {
        Alert.alert('Succès', 'Les modifications ont été enregistrées');
        navigation.goBack();
      }
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
        <Text style={styles.headerTitle}>Règlement intérieur</Text>
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
        <View style={styles.section}>
          {/* Heures d'arrivée et de départ */}
          <View style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <Ionicons name="time-outline" size={24} color="#e67e22" />
              <Text style={styles.optionTitle}>Horaires</Text>
            </View>
            <View style={styles.optionContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Heure d'arrivée</Text>
                <TextInput
                  style={styles.input}
                  value={checkInTime}
                  onChangeText={setCheckInTime}
                  placeholder="14:00"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Heure de départ</Text>
                <TextInput
                  style={styles.input}
                  value={checkOutTime}
                  onChangeText={setCheckOutTime}
                  placeholder="11:00"
                />
              </View>
            </View>
          </View>

          {/* Événements autorisés */}
          <View style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <View style={styles.optionHeaderLeft}>
                <Ionicons name="musical-notes-outline" size={24} color="#e67e22" />
                <Text style={styles.optionTitle}>Événements autorisés</Text>
              </View>
              <Switch
                value={eventsAllowed}
                onValueChange={setEventsAllowed}
                trackColor={{ false: '#ccc', true: '#e67e22' }}
              />
            </View>
          </View>

          {/* Fumer */}
          <View style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <View style={styles.optionHeaderLeft}>
                <Ionicons name="ban-outline" size={24} color="#e67e22" />
                <Text style={styles.optionTitle}>Fumer autorisé</Text>
              </View>
              <Switch
                value={smokingAllowed}
                onValueChange={setSmokingAllowed}
                trackColor={{ false: '#ccc', true: '#e67e22' }}
              />
            </View>
          </View>

          {/* Animaux autorisés */}
          <View style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <View style={styles.optionHeaderLeft}>
                <Ionicons name="paw-outline" size={24} color="#e67e22" />
                <Text style={styles.optionTitle}>Animaux autorisés</Text>
              </View>
              <Switch
                value={petsAllowed}
                onValueChange={setPetsAllowed}
                trackColor={{ false: '#ccc', true: '#e67e22' }}
              />
            </View>
          </View>

          {/* Autres règles */}
          <View style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <Ionicons name="document-text-outline" size={24} color="#e67e22" />
              <Text style={styles.optionTitle}>Autres règles</Text>
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.inputLabel}>
                Ajoutez d'autres règles spécifiques à votre logement
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={otherRules}
                onChangeText={setOtherRules}
                placeholder="ex: Respecter les voisins, Ne pas utiliser la piscine après 22h..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
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
  textArea: {
    minHeight: 100,
    paddingTop: 10,
    paddingBottom: 10,
  },
});

export default PropertyRulesScreen;

