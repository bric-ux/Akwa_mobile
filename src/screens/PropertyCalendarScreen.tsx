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
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAvailabilityCalendar } from '../hooks/useAvailabilityCalendar';
import { useBlockedDates, BlockedDate } from '../hooks/useBlockedDates';
import { useDynamicPricing } from '../hooks/useDynamicPricing';
import { supabase } from '../services/supabase';

const PropertyCalendarScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { propertyId } = route.params as { propertyId: string };

  const { unavailableDates, loading: calendarLoading, refetch, isDateUnavailable } = useAvailabilityCalendar(propertyId);
  const { getBlockedDates, blockDates, unblockDates, loading: blockedLoading } = useBlockedDates();
  const { getDynamicPrices, setPriceForPeriod, deleteDynamicPrice, loading: pricingLoading } = useDynamicPricing();

  const [blockedDatesList, setBlockedDatesList] = useState<BlockedDate[]>([]);
  const [dynamicPrices, setDynamicPrices] = useState<any[]>([]);
  const [basePrice, setBasePrice] = useState<number | null>(null);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadBlockedDates();
    loadDynamicPrices();
    loadBasePrice();
  }, [propertyId]);

  const loadBasePrice = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('price_per_night')
        .eq('id', propertyId)
        .single();
      
      if (!error && data) {
        setBasePrice(data.price_per_night);
      }
    } catch (error) {
      console.error('Error loading base price:', error);
    }
  };

  const loadBlockedDates = async () => {
    const dates = await getBlockedDates(propertyId);
    setBlockedDatesList(dates);
  };

  const loadDynamicPrices = async () => {
    const prices = await getDynamicPrices(propertyId);
    setDynamicPrices(prices);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadBlockedDates(),
      loadDynamicPrices(),
      refetch(),
    ]);
    setRefreshing(false);
  };

  const handleDatePress = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    if (compareDate < today || isDateUnavailable(date)) {
      return; // Ne pas permettre la sélection des dates passées ou indisponibles
    }

    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      // Nouvelle sélection
      setSelectedStartDate(date);
      setSelectedEndDate(null);
      setIsSelectingRange(true);
    } else if (selectedStartDate && !selectedEndDate) {
      // Compléter la plage
      if (date >= selectedStartDate) {
        setSelectedEndDate(date);
        setIsSelectingRange(false);
      } else {
        // Si la date sélectionnée est avant la date de début, inverser
        setSelectedEndDate(selectedStartDate);
        setSelectedStartDate(date);
        setIsSelectingRange(false);
      }
    }
  };

  // Fonction pour formater une date en YYYY-MM-DD sans problème de fuseau horaire
  const formatDateToISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleBlockDates = async () => {
    if (!selectedStartDate || !selectedEndDate) {
      Alert.alert('Erreur', 'Veuillez sélectionner une période');
      return;
    }

    const startDateStr = formatDateToISO(selectedStartDate);
    const endDateStr = formatDateToISO(selectedEndDate);

    const result = await blockDates(propertyId, startDateStr, endDateStr, reason);

    if (result.success) {
      setSelectedStartDate(null);
      setSelectedEndDate(null);
      setReason('');
      setIsSelectingRange(false);
      await loadBlockedDates();
      await refetch();
    }
  };

  const handleUnblock = async (id: string) => {
    Alert.alert(
      'Débloquer les dates',
      'Êtes-vous sûr de vouloir débloquer ces dates ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Débloquer',
          style: 'destructive',
          onPress: async () => {
            const result = await unblockDates(id);
            if (result.success) {
              loadBlockedDates();
              refetch();
            }
          },
        },
      ]
    );
  };

  const handleSetPrice = async () => {
    if (!selectedStartDate || !selectedEndDate || !customPrice) {
      Alert.alert('Erreur', 'Veuillez sélectionner une période et entrer un prix');
      return;
    }

    const startDateStr = formatDateToISO(selectedStartDate);
    const endDateStr = formatDateToISO(selectedEndDate);
    const price = parseInt(customPrice);

    if (isNaN(price) || price <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix valide');
      return;
    }

    const result = await setPriceForPeriod(propertyId, startDateStr, endDateStr, price);

    if (result.success) {
      setSelectedStartDate(null);
      setSelectedEndDate(null);
      setCustomPrice('');
      setIsSelectingRange(false);
      await loadDynamicPrices();
    }
  };

  const handleDeletePrice = async (priceId: string) => {
    Alert.alert(
      'Supprimer le prix',
      'Êtes-vous sûr de vouloir supprimer ce prix personnalisé ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteDynamicPrice(priceId);
            if (result.success) {
              loadDynamicPrices();
            }
          },
        },
      ]
    );
  };

  // Fonction pour obtenir le prix d'une date
  const getPriceForDate = (date: Date): number | null => {
    const dateStr = formatDateToISO(date);
    const priceInfo = dynamicPrices.find(price => {
      return dateStr >= price.start_date && dateStr <= price.end_date;
    });
    return priceInfo ? priceInfo.price_per_night : basePrice;
  };

  // Fonction pour vérifier si une date a un prix personnalisé
  const hasCustomPrice = (date: Date): boolean => {
    const dateStr = formatDateToISO(date);
    return dynamicPrices.some(price => {
      return dateStr >= price.start_date && dateStr <= price.end_date;
    });
  };

  // Fonction pour obtenir le type de blocage d'une date
  const getDateBlockType = (date: Date): 'reserved' | 'blocked' | 'available' => {
    const dateStr = formatDateToISO(date);
    const unavailable = unavailableDates.find(period => {
      return dateStr >= period.start_date && dateStr <= period.end_date;
    });
    
    if (!unavailable) return 'available';
    
    // Vérifier si c'est une date bloquée manuellement
    const isBlocked = blockedDatesList.some(blocked => {
      return dateStr >= blocked.start_date && dateStr <= blocked.end_date;
    });
    
    return isBlocked ? 'blocked' : 'reserved';
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendrier de disponibilité</Text>
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
              <Ionicons name="chevron-back" size={24} color="#e67e22" />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => navigateMonth('next')}>
              <Ionicons name="chevron-forward" size={24} color="#e67e22" />
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
              const unavailable = isDateUnavailable(date);
              const blockType = getDateBlockType(date);
              const isSelected = selectedStartDate && selectedEndDate &&
                date >= selectedStartDate && date <= selectedEndDate;
              const isStart = selectedStartDate && date.getTime() === selectedStartDate.getTime();
              const isEnd = selectedEndDate && date.getTime() === selectedEndDate.getTime();
              const price = !isPast && !unavailable ? getPriceForDate(date) : null;
              const hasCustomPriceForDate = !isPast && !unavailable ? hasCustomPrice(date) : false;

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.dayCell,
                    isPast && styles.dayCellPast,
                    unavailable && blockType === 'reserved' && styles.dayCellReserved,
                    unavailable && blockType === 'blocked' && styles.dayCellBlocked,
                    isSelected && styles.dayCellSelected,
                    isStart && styles.dayCellStart,
                    isEnd && styles.dayCellEnd,
                    !isPast && !unavailable && hasCustomPriceForDate && styles.dayCellCustomPrice,
                  ]}
                  onPress={() => handleDatePress(date)}
                  disabled={isPast || unavailable}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isPast && styles.dayTextPast,
                      unavailable && blockType === 'reserved' && styles.dayTextReserved,
                      unavailable && blockType === 'blocked' && styles.dayTextBlocked,
                      isSelected && styles.dayTextSelected,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                  {price && (
                    <Text style={[
                      styles.priceText,
                      hasCustomPriceForDate && styles.priceTextCustom
                    ]}>
                      {(price / 1000).toFixed(0)}k
                    </Text>
                  )}
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
                  {Math.ceil((selectedEndDate.getTime() - selectedStartDate.getTime()) / (1000 * 60 * 60 * 24))} jour(s)
                </Text>
              )}
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.label}>Raison (optionnel)</Text>
              <TextInput
                style={styles.textInput}
                value={reason}
                onChangeText={setReason}
                placeholder="Ex: Travaux, vacances personnelles..."
                multiline
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.label}>Prix personnalisé (XOF/nuit)</Text>
              <TextInput
                style={styles.textInput}
                value={customPrice}
                onChangeText={setCustomPrice}
                placeholder="Ex: 15000"
                keyboardType="numeric"
              />
              <Text style={styles.hint}>
                Laissez vide pour bloquer sans modifier le prix
              </Text>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.blockButton]}
                onPress={handleBlockDates}
                disabled={blockedLoading || !selectedStartDate || !selectedEndDate || isSelectingRange}
              >
                {blockedLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Bloquer</Text>
                  </>
                )}
              </TouchableOpacity>

              {customPrice && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.priceButton]}
                  onPress={handleSetPrice}
                  disabled={pricingLoading || !selectedStartDate || !selectedEndDate || isSelectingRange}
                >
                  {pricingLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="cash" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Définir prix</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => {
                  setSelectedStartDate(null);
                  setSelectedEndDate(null);
                  setReason('');
                  setCustomPrice('');
                  setIsSelectingRange(false);
                }}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Périodes indisponibles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Périodes indisponibles</Text>
          {calendarLoading ? (
            <ActivityIndicator size="small" color="#e67e22" />
          ) : unavailableDates.length === 0 ? (
            <Text style={styles.emptyText}>Aucune période indisponible</Text>
          ) : (
            unavailableDates.map((period, index) => {
              const isBlocked = blockedDatesList.find(
                b => b.start_date === period.start_date && b.end_date === period.end_date
              );

              return (
                <View key={index} style={styles.periodCard}>
                  <View style={styles.periodInfo}>
                    <View style={[
                      styles.badge,
                      period.reason === 'Réservé' ? styles.badgeReserved : styles.badgeBlocked
                    ]}>
                      <Text style={styles.badgeText}>
                        {period.reason || 'Bloqué'}
                      </Text>
                    </View>
                    <Text style={styles.periodDate}>
                      {period.start_date === period.end_date ? (
                        formatDateShort(new Date(period.start_date))
                      ) : (
                        `${formatDateShort(new Date(period.start_date))} → ${formatDateShort(new Date(period.end_date))}`
                      )}
                    </Text>
                  </View>
                  {isBlocked && (
                    <TouchableOpacity
                      onPress={() => handleUnblock(isBlocked.id)}
                      disabled={blockedLoading}
                    >
                      <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Prix personnalisés */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prix personnalisés</Text>
          {dynamicPrices.length === 0 ? (
            <Text style={styles.emptyText}>Aucun prix personnalisé défini</Text>
          ) : (
            dynamicPrices.map((price) => (
              <View key={price.id} style={styles.priceCard}>
                <View style={styles.priceInfo}>
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceBadgeText}>
                      {price.price_per_night.toLocaleString('fr-FR')} XOF/nuit
                    </Text>
                  </View>
                  <Text style={styles.priceDate}>
                    {price.start_date === price.end_date ? (
                      formatDateShort(new Date(price.start_date))
                    ) : (
                      `${formatDateShort(new Date(price.start_date))} → ${formatDateShort(new Date(price.end_date))}`
                    )}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeletePrice(price.id)}
                  disabled={pricingLoading}
                >
                  <Ionicons name="trash-outline" size={20} color="#e74c3c" />
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
              <View style={[styles.legendColor, { backgroundColor: '#e67e22' }]} />
              <Text style={styles.legendText}>Réservé</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#e74c3c' }]} />
              <Text style={styles.legendText}>Bloqué manuellement</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { borderWidth: 2, borderColor: '#3498db' }]} />
              <Text style={styles.legendText}>Prix de base</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { borderWidth: 2, borderColor: '#2ecc71' }]} />
              <Text style={styles.legendText}>Prix personnalisé</Text>
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
  calendarSection: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
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
    color: '#666',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  dayCellPast: {
    backgroundColor: '#f5f5f5',
    opacity: 0.5,
  },
  dayCellReserved: {
    backgroundColor: '#fff3e0',
    borderColor: '#e67e22',
    borderWidth: 2,
  },
  dayCellBlocked: {
    backgroundColor: '#ffebee',
    borderColor: '#e74c3c',
    borderWidth: 2,
  },
  dayCellCustomPrice: {
    borderWidth: 2,
    borderColor: '#2ecc71',
  },
  dayCellSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
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
    color: '#333',
  },
  dayTextPast: {
    color: '#999',
  },
  dayTextReserved: {
    color: '#e67e22',
    fontWeight: '600',
  },
  dayTextBlocked: {
    color: '#e74c3c',
    fontWeight: '600',
  },
  dayTextSelected: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  priceText: {
    fontSize: 8,
    color: '#3498db',
    fontWeight: 'bold',
    marginTop: 2,
  },
  priceTextCustom: {
    color: '#2ecc71',
  },
  selectionSection: {
    margin: 20,
    marginTop: 0,
  },
  selectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  selectionCardActive: {
    borderColor: '#ffc107',
    backgroundColor: '#fffbf0',
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  selectionDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  selectionDays: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 4,
  },
  inputSection: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    fontSize: 14,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  blockButton: {
    backgroundColor: '#e74c3c',
  },
  priceButton: {
    backgroundColor: '#2ecc71',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    flex: 0,
    paddingHorizontal: 20,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  periodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  periodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeReserved: {
    backgroundColor: '#e67e22',
  },
  badgeBlocked: {
    backgroundColor: '#e74c3c',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  periodDate: {
    fontSize: 14,
    color: '#333',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
  },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    marginBottom: 8,
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  priceBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priceBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  priceDate: {
    fontSize: 14,
    color: '#333',
  },
  legend: {
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 14,
    color: '#666',
  },
});

export default PropertyCalendarScreen;

