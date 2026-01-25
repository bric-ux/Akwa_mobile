import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { VEHICLE_COLORS } from '../constants/colors';
import { RootStackParamList } from '../types';

type VehicleCalendarRouteProp = RouteProp<RootStackParamList, 'VehicleCalendar'>;

interface BlockedDate {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

const formatDateToISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const VehicleCalendarScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<VehicleCalendarRouteProp>();
  const { vehicleId } = route.params;
  
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUnavailableDates();
  }, [vehicleId]);

  const loadUnavailableDates = async () => {
    try {
      setRefreshing(true);
      
      // Charger les dates bloquées manuellement
      const { data: blockedData, error: blockedError } = await supabase
        .from('vehicle_blocked_dates')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('start_date', { ascending: true });

      if (blockedError) throw blockedError;
      setBlockedDates(blockedData || []);

      // Charger les réservations (pending, confirmed - les réservations terminées ne bloquent pas)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('vehicle_bookings')
        .select('id, start_date, end_date, status')
        .eq('vehicle_id', vehicleId)
        .in('status', ['pending', 'confirmed'])
        .gte('end_date', todayStr)
        .order('start_date', { ascending: true });

      if (bookingsError) {
        console.error('Erreur lors du chargement des réservations:', bookingsError);
      } else {
        setBookings(bookingsData || []);
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des dates:', error);
      Alert.alert('Erreur', 'Impossible de charger les dates');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await loadUnavailableDates();
  };

  const isDateBlocked = (date: Date): BlockedDate | undefined => {
    const dateStr = formatDateToISO(date);
    return blockedDates.find(blocked => {
      return dateStr >= blocked.start_date && dateStr <= blocked.end_date;
    });
  };

  const isDateBooked = (date: Date): boolean => {
    const dateStr = formatDateToISO(date);
    return bookings.some(booking => {
      return dateStr >= booking.start_date && dateStr <= booking.end_date;
    });
  };

  const isDateUnavailable = (date: Date): boolean => {
    return isDateBlocked(date) !== undefined || isDateBooked(date);
  };

  const handleDatePress = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) {
      return; // Ne pas permettre la sélection de dates passées
    }

    const blocked = isDateBlocked(date);
    const booked = isDateBooked(date);
    
    // Si la date est réservée, ne pas permettre la sélection
    if (booked) {
      Alert.alert(
        'Date réservée',
        'Cette date est déjà réservée et ne peut pas être modifiée.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Si on clique sur une date bloquée manuellement, proposer de la débloquer
    if (blocked) {
      Alert.alert(
        'Débloquer cette période',
        `Voulez-vous débloquer la période du ${formatDate(new Date(blocked.start_date))} au ${formatDate(new Date(blocked.end_date))} ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Débloquer',
            style: 'destructive',
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
      return;
    }

    // Logique de sélection de plage
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      // Commencer une nouvelle sélection
      setSelectedStartDate(date);
      setSelectedEndDate(null);
      setIsSelectingRange(true);
    } else if (selectedStartDate && !selectedEndDate) {
      // Compléter la sélection
      if (date < selectedStartDate) {
        // Si la date sélectionnée est avant la date de début, inverser
        setSelectedEndDate(selectedStartDate);
        setSelectedStartDate(date);
      } else {
        setSelectedEndDate(date);
      }
      setIsSelectingRange(false);
    }
  };

  const handleBlockDates = async () => {
    if (!selectedStartDate || !selectedEndDate) {
      Alert.alert('Erreur', 'Veuillez sélectionner une période complète');
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
          start_date: formatDateToISO(selectedStartDate),
          end_date: formatDateToISO(selectedEndDate),
          reason: reason.trim() || 'Blocage manuel',
          created_by: user.id,
        });

      if (error) throw error;

      Alert.alert(
        'Succès',
        `Les dates du ${formatDate(selectedStartDate)} au ${formatDate(selectedEndDate)} ont été bloquées.`
      );

      setSelectedStartDate(null);
      setSelectedEndDate(null);
      setReason('');
      setIsSelectingRange(false);
      await loadBlockedDates();
    } catch (error: any) {
      console.error('Erreur lors du blocage des dates:', error);
      Alert.alert('Erreur', error.message || 'Impossible de bloquer les dates');
    } finally {
      setLoading(false);
    }
  };

  const getDateBlockType = (date: Date): 'blocked' | 'available' => {
    return isDateBlocked(date) ? 'blocked' : 'available';
  };

  // Fonction pour générer les jours du mois
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Ajouter les jours vides du début
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Ajouter les jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const days = getDaysInMonth(currentMonth);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendrier</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Calendrier */}
        <View style={styles.calendarSection}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => navigateMonth('prev')}>
              <Ionicons name="chevron-back" size={24} color={VEHICLE_COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => navigateMonth('next')}>
              <Ionicons name="chevron-forward" size={24} color={VEHICLE_COLORS.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.calendarGrid}>
            {/* Jours de la semaine */}
            {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((day, index) => (
              <View key={index} style={styles.dayHeader}>
                <Text style={styles.dayHeaderText}>{day}</Text>
              </View>
            ))}

            {/* Jours du mois */}
            {days.map((date, index) => {
              if (!date) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }

              const dateStr = formatDateToISO(date);
              const isPast = date < today;
              const blocked = isDateBlocked(date);
              const booked = isDateBooked(date);
              const unavailable = isDateUnavailable(date);
              const blockType = getDateBlockType(date);
              const isSelected = selectedStartDate && selectedEndDate &&
                date >= selectedStartDate && date <= selectedEndDate;
              const isStart = selectedStartDate && date.getTime() === selectedStartDate.getTime();
              const isEnd = selectedEndDate && date.getTime() === selectedEndDate.getTime();
              const isAvailable = !isPast && !unavailable;

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.dayCell,
                    isPast && styles.dayCellPast,
                    isAvailable && styles.dayCellAvailable,
                    (blocked || booked) && styles.dayCellBlocked,
                    isSelected && styles.dayCellSelected,
                    isStart && styles.dayCellStart,
                    isEnd && styles.dayCellEnd,
                  ]}
                  onPress={() => handleDatePress(date)}
                  disabled={isPast || unavailable}
                >
                  <Text
                    style={[
                    styles.dayText,
                    isPast && styles.dayTextPast,
                    isAvailable && styles.dayTextAvailable,
                    (blocked || booked) && styles.dayTextBlocked,
                    isSelected && styles.dayTextSelected,
                  ]}
                  >
                    {date.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section de sélection */}
        {(selectedStartDate || isSelectingRange) && (
          <View style={styles.selectionSection}>
            <View style={[
              styles.selectionCard,
              isSelectingRange && styles.selectionCardActive
            ]}>
              <Text style={styles.selectionTitle}>
                {isSelectingRange ? 'Sélection en cours...' : 'Période sélectionnée'}
              </Text>
              {selectedStartDate && (
                <Text style={styles.selectionDate}>
                  Du {formatDate(selectedStartDate)}
                </Text>
              )}
              {selectedEndDate && (
                <Text style={styles.selectionDate}>
                  Au {formatDate(selectedEndDate)}
                </Text>
              )}
              {selectedStartDate && selectedEndDate && (
                <Text style={styles.selectionDays}>
                  {Math.ceil((selectedEndDate.getTime() - selectedStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} jour(s)
                </Text>
              )}
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.label}>Raison (optionnel)</Text>
              <TextInput
                style={styles.textInput}
                value={reason}
                onChangeText={setReason}
                placeholder="Ex: Maintenance, vacances personnelles..."
                multiline
              />
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.blockButton]}
                onPress={handleBlockDates}
                disabled={loading || !selectedStartDate || !selectedEndDate || isSelectingRange}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="lock-closed-outline" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Bloquer</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => {
                  setSelectedStartDate(null);
                  setSelectedEndDate(null);
                  setReason('');
                  setIsSelectingRange(false);
                }}
              >
                <Ionicons name="close" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Réservations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Réservations ({bookings.length})</Text>
          {refreshing ? (
            <ActivityIndicator size="small" color={VEHICLE_COLORS.primary} />
          ) : bookings.length === 0 ? (
            <Text style={styles.emptyText}>Aucune réservation</Text>
          ) : (
            bookings.map((booking) => (
              <View key={booking.id} style={styles.periodCard}>
                <View style={styles.periodInfo}>
                  <View style={[styles.badgeBlocked, { backgroundColor: '#2563eb' }]}>
                    <Text style={styles.badgeText}>
                      {booking.status === 'confirmed' ? 'Confirmée' : 
                       booking.status === 'pending' ? 'En attente' : 'En cours'}
                    </Text>
                  </View>
                  <Text style={styles.periodDate}>
                    {booking.start_date === booking.end_date ? (
                      formatDateShort(new Date(booking.start_date))
                    ) : (
                      `${formatDateShort(new Date(booking.start_date))} → ${formatDateShort(new Date(booking.end_date))}`
                    )}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Périodes bloquées */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Périodes bloquées manuellement ({blockedDates.length})</Text>
          {refreshing ? (
            <ActivityIndicator size="small" color={VEHICLE_COLORS.primary} />
          ) : blockedDates.length === 0 ? (
            <Text style={styles.emptyText}>Aucune période bloquée</Text>
          ) : (
            blockedDates.map((blocked) => (
              <View key={blocked.id} style={styles.periodCard}>
                <View style={styles.periodInfo}>
                  <View style={styles.badgeBlocked}>
                    <Text style={styles.badgeText}>
                      {blocked.reason || 'Bloqué'}
                    </Text>
                  </View>
                  <Text style={styles.periodDate}>
                    {blocked.start_date === blocked.end_date ? (
                      formatDateShort(new Date(blocked.start_date))
                    ) : (
                      `${formatDateShort(new Date(blocked.start_date))} → ${formatDateShort(new Date(blocked.end_date))}`
                    )}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Débloquer cette période',
                      `Voulez-vous débloquer la période du ${formatDate(new Date(blocked.start_date))} au ${formatDate(new Date(blocked.end_date))} ?`,
                      [
                        { text: 'Annuler', style: 'cancel' },
                        {
                          text: 'Débloquer',
                          style: 'destructive',
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
                  }}
                  disabled={loading}
                >
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Légende */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Légende</Text>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#10b981' }]} />
              <Text style={styles.legendText}>Disponible</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.legendText}>Bloqué</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#475569' }]} />
              <Text style={styles.legendText}>Sélectionné</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#9e9e9e' }]} />
              <Text style={styles.legendText}>Date passée</Text>
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
  scrollView: {
    flex: 1,
  },
  calendarSection: {
    backgroundColor: '#fff',
    margin: 20,
    marginBottom: 12,
    padding: 20,
    borderRadius: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    textTransform: 'capitalize',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayHeader: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dayCellPast: {
    backgroundColor: '#f3f4f6',
  },
  dayCellAvailable: {
    backgroundColor: '#f0fdf4',
  },
  dayCellBlocked: {
    backgroundColor: '#fef2f2',
  },
  dayCellSelected: {
    backgroundColor: '#475569',
  },
  dayCellStart: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  dayCellEnd: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  dayTextPast: {
    color: '#9e9e9e',
  },
  dayTextAvailable: {
    color: '#10b981',
  },
  dayTextBlocked: {
    color: '#ef4444',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  selectionSection: {
    backgroundColor: '#fff',
    margin: 20,
    marginBottom: 12,
    padding: 20,
    borderRadius: 12,
  },
  selectionCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  selectionCardActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#475569',
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  selectionDate: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  selectionDays: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginTop: 4,
  },
  inputSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  blockButton: {
    backgroundColor: '#1e293b',
  },
  cancelButton: {
    backgroundColor: '#6b7280',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    margin: 20,
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
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  periodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  periodInfo: {
    flex: 1,
  },
  badgeBlocked: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  periodDate: {
    fontSize: 14,
    color: '#991b1b',
    fontWeight: '500',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
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
    color: '#6b7280',
  },
});

export default VehicleCalendarScreen;
