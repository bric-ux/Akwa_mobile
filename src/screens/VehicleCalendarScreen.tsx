import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../services/supabase';
import { VEHICLE_COLORS } from '../constants/colors';
import { RootStackParamList } from '../types';
// Utiliser le formatage natif JavaScript pour éviter la dépendance date-fns
const formatDate = (date: Date, formatStr: string = 'dd/MM/yyyy'): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  if (formatStr === 'dd/MM/yyyy') {
    return `${day}/${month}/${year}`;
  }
  return `${day}/${month}/${year}`;
};

type VehicleCalendarRouteProp = RouteProp<RootStackParamList, 'VehicleCalendar'>;

interface BlockedDate {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

const VehicleCalendarScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<VehicleCalendarRouteProp>();
  const { vehicleId } = route.params;
  const scrollViewRef = useRef<ScrollView>(null);
  const blockedDatesSectionRef = useRef<View>(null);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadBlockedDates();
  }, [vehicleId]);

  const loadBlockedDates = async () => {
    try {
      setRefreshing(true);
      const { data, error } = await supabase
        .from('vehicle_blocked_dates')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('start_date', { ascending: true });

      if (error) throw error;
      setBlockedDates(data || []);
    } catch (error: any) {
      console.error('Erreur lors du chargement des dates bloquées:', error);
      Alert.alert('Erreur', 'Impossible de charger les dates bloquées');
    } finally {
      setRefreshing(false);
    }
  };

  const handleBlockDates = async () => {
    if (!selectedStartDate || !selectedEndDate) {
      Alert.alert('Erreur', 'Veuillez sélectionner une période');
      return;
    }

    if (selectedStartDate > selectedEndDate) {
      Alert.alert('Erreur', 'La date de fin doit être après la date de début');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');

      const { error } = await supabase
        .from('vehicle_blocked_dates')
        .insert({
          vehicle_id: vehicleId,
          start_date: selectedStartDate.toISOString().split('T')[0],
          end_date: selectedEndDate.toISOString().split('T')[0],
          reason: 'Blocage manuel',
          created_by: user.id,
        });

      if (error) throw error;

      setSelectedStartDate(null);
      setSelectedEndDate(null);
      await loadBlockedDates();
      
      // Scroll vers la liste des périodes bloquées après un court délai
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);

      Alert.alert(
        'Succès',
        `Les dates du ${formatDate(selectedStartDate)} au ${formatDate(selectedEndDate)} ont été bloquées.`
      );
    } catch (error: any) {
      console.error('Erreur lors du blocage des dates:', error);
      Alert.alert('Erreur', error.message || 'Impossible de bloquer les dates');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblockDates = (blocked: BlockedDate) => {
      Alert.alert(
        'Débloquer ces dates',
        `Voulez-vous débloquer la période du ${formatDate(new Date(blocked.start_date))} au ${formatDate(new Date(blocked.end_date))} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Débloquer',
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase
                .from('vehicle_blocked_dates')
                .delete()
                .eq('id', blocked.id);

              if (error) throw error;

              Alert.alert('Succès', 'Les dates ont été débloquées avec succès.');
              await loadBlockedDates();
            } catch (error: any) {
              console.error('Erreur lors du déblocage des dates:', error);
              Alert.alert('Erreur', error.message || 'Impossible de débloquer les dates');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendrier</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Légende */}
        <View style={styles.legendCard}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.legendText}>Bloqué</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#475569' }]} />
            <Text style={styles.legendText}>Sélectionné</Text>
          </View>
        </View>

        {/* Sélection de dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bloquer une période</Text>
          
          <View style={styles.dateSelectors}>
            <TouchableOpacity
              style={styles.dateSelector}
              onPress={() => setShowStartPicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#475569" />
              <View style={styles.dateSelectorContent}>
                <Text style={styles.dateLabel}>Date de début</Text>
                <Text style={styles.dateValue}>
                  {selectedStartDate
                    ? formatDate(selectedStartDate)
                    : 'Sélectionner'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateSelector}
              onPress={() => setShowEndPicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#475569" />
              <View style={styles.dateSelectorContent}>
                <Text style={styles.dateLabel}>Date de fin</Text>
                <Text style={styles.dateValue}>
                  {selectedEndDate
                    ? formatDate(selectedEndDate)
                    : 'Sélectionner'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {selectedStartDate && selectedEndDate && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setSelectedStartDate(null);
                  setSelectedEndDate(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.blockButton}
                onPress={handleBlockDates}
                disabled={loading}
              >
                <Ionicons name="lock-closed-outline" size={18} color="#fff" />
                <Text style={styles.blockButtonText}>
                  {loading ? 'Blocage...' : 'Bloquer'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Liste des périodes bloquées */}
        {blockedDates.length > 0 && (
          <View ref={blockedDatesSectionRef} style={styles.section}>
            <Text style={styles.sectionTitle}>Périodes bloquées ({blockedDates.length})</Text>
            {blockedDates.map((blocked) => (
              <View key={blocked.id} style={styles.blockedItem}>
                <View style={styles.blockedItemContent}>
                  <Text style={styles.blockedDateText}>
                    {formatDate(new Date(blocked.start_date))} - {formatDate(new Date(blocked.end_date))}
                  </Text>
                  {blocked.reason && (
                    <Text style={styles.blockedReason}>{blocked.reason}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.unblockButton}
                  onPress={() => handleUnblockDates(blocked)}
                  disabled={loading}
                >
                  <Ionicons name="lock-open-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {blockedDates.length === 0 && !refreshing && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Aucune période bloquée</Text>
          </View>
        )}
      </ScrollView>

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={selectedStartDate || new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(event, date) => {
            setShowStartPicker(false);
            if (date) {
              setSelectedStartDate(date);
            }
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={selectedEndDate || selectedStartDate || new Date()}
          mode="date"
          display="default"
          minimumDate={selectedStartDate || new Date()}
          onChange={(event, date) => {
            setShowEndPicker(false);
            if (date) {
              setSelectedEndDate(date);
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  legendCard: {
    backgroundColor: '#fff',
    margin: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  dateSelectors: {
    gap: 12,
    marginBottom: 16,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    gap: 12,
  },
  dateSelectorContent: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  blockButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    gap: 8,
  },
  blockButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  blockedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    marginBottom: 8,
  },
  blockedItemContent: {
    flex: 1,
  },
  blockedDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991b1b',
    marginBottom: 4,
  },
  blockedReason: {
    fontSize: 12,
    color: '#dc2626',
  },
  unblockButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
});

export default VehicleCalendarScreen;

