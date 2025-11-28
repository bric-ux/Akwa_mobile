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
import { useICalSync, ICalLink } from '../hooks/useICalSync';
import { supabase } from '../services/supabase';
import * as Clipboard from 'expo-clipboard';

const PropertyCalendarScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { propertyId } = route.params as { propertyId: string };

  const { unavailableDates, loading: calendarLoading, refetch, isDateUnavailable } = useAvailabilityCalendar(propertyId);
  const { getBlockedDates, blockDates, unblockDates, loading: blockedLoading } = useBlockedDates();
  const { getICalLinks, addICalLink, syncCalendar, removeICalLink, loading: icalLoading } = useICalSync();

  const [blockedDatesList, setBlockedDatesList] = useState<BlockedDate[]>([]);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [icalLinks, setICalLinks] = useState<ICalLink[]>([]);
  const [showICalForm, setShowICalForm] = useState(false);
  const [icalUrl, setICalUrl] = useState('');
  const [icalPlatform, setICalPlatform] = useState('airbnb');
  const [exportUrl, setExportUrl] = useState<string>('');

  useEffect(() => {
    loadBlockedDates();
    loadICalLinks();
    generateExportUrl();
  }, [propertyId]);

  const generateExportUrl = async () => {
    // Générer l'URL d'export iCal pour cette propriété
    // Note: Cette URL devra être générée côté serveur, pour l'instant on utilise une URL générique
    // L'URL d'export sera générée par le backend
    // Pour l'instant, on utilise une URL placeholder qui sera remplacée par le backend
    // TODO: Remplacer par l'URL réelle du backend
    setExportUrl(`https://api.akwahome.com/api/ical/export/${propertyId}`);
  };

  const handleCopyExportUrl = async () => {
    try {
      await Clipboard.setStringAsync(exportUrl);
      Alert.alert('Succès', 'Lien d\'export copié dans le presse-papiers');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de copier le lien');
    }
  };

  const loadBlockedDates = async () => {
    const dates = await getBlockedDates(propertyId);
    setBlockedDatesList(dates);
  };

  const loadICalLinks = async () => {
    const links = await getICalLinks(propertyId);
    setICalLinks(links);
  };

  const handleAddICalLink = async () => {
    if (!icalUrl.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une URL iCal');
      return;
    }
    
    const result = await addICalLink(propertyId, icalPlatform, icalUrl);
    if (result.success) {
      setICalUrl('');
      setShowICalForm(false);
      await loadICalLinks();
      await refetch();
      await loadBlockedDates();
    }
  };

  const handleSyncCalendar = async (platform: string) => {
    const result = await syncCalendar(propertyId, platform);
    if (result.success) {
      await refetch();
      await loadBlockedDates();
      await loadICalLinks();
    }
  };

  const handleRemoveICalLink = async (linkId: string) => {
    Alert.alert(
      'Confirmer la suppression',
      'Êtes-vous sûr de vouloir supprimer ce lien de synchronisation ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const result = await removeICalLink(linkId);
            if (result.success) {
              await loadICalLinks();
              await loadBlockedDates();
              await refetch();
            }
          },
        },
      ]
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadBlockedDates(),
      loadICalLinks(),
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
              const isAvailable = !isPast && !unavailable;

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.dayCell,
                    isPast && styles.dayCellPast,
                    isAvailable && styles.dayCellAvailable,
                    unavailable && blockType === 'reserved' && styles.dayCellReserved,
                    unavailable && blockType === 'blocked' && styles.dayCellBlocked,
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
                      unavailable && blockType === 'reserved' && styles.dayTextReserved,
                      unavailable && blockType === 'blocked' && styles.dayTextBlocked,
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

        {/* Lien d'export iCal */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="share-outline" size={20} color="#e67e22" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Lien d'export pour autres sites</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Copiez ce lien pour synchroniser votre calendrier avec d'autres plateformes (Airbnb, Booking.com, etc.)
          </Text>
          
          <View style={styles.exportUrlContainer}>
            <Text style={styles.exportUrlText} numberOfLines={1}>
              {exportUrl}
            </Text>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyExportUrl}
            >
              <Ionicons name="copy-outline" size={20} color="#e67e22" />
              <Text style={styles.copyButtonText}>Copier</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Synchronisation iCal */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="link" size={20} color="#e67e22" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Synchronisation Airbnb & autres plateformes</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Importez automatiquement les réservations depuis d'autres plateformes via iCal
          </Text>

          {!showICalForm ? (
            <TouchableOpacity
              style={styles.addICalButton}
              onPress={() => setShowICalForm(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#e67e22" />
              <Text style={styles.addICalButtonText}>Ajouter une synchronisation</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.icalForm}>
              <View style={styles.inputSection}>
                <Text style={styles.label}>Plateforme</Text>
                <View style={styles.platformSelector}>
                  {['airbnb', 'booking', 'vrbo', 'other'].map((platform) => (
                    <TouchableOpacity
                      key={platform}
                      style={[
                        styles.platformOption,
                        icalPlatform === platform && styles.platformOptionActive,
                        { marginRight: 8, marginBottom: 8 }
                      ]}
                      onPress={() => setICalPlatform(platform)}
                    >
                      <Text style={[
                        styles.platformOptionText,
                        icalPlatform === platform && styles.platformOptionTextActive
                      ]}>
                        {platform.charAt(0).toUpperCase() + platform.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.label}>URL du calendrier iCal</Text>
                <TextInput
                  style={styles.textInput}
                  value={icalUrl}
                  onChangeText={setICalUrl}
                  placeholder="https://www.airbnb.com/calendar/ical/..."
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.hint}>
                  Copiez l'URL iCal depuis les paramètres de votre calendrier sur {icalPlatform}
                </Text>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.blockButton]}
                  onPress={handleAddICalLink}
                  disabled={icalLoading || !icalUrl.trim()}
                >
                  {icalLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Ajouter</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => {
                    setShowICalForm(false);
                    setICalUrl('');
                  }}
                >
                  <Ionicons name="close" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Liste des synchronisations actives */}
          {icalLinks.length > 0 && (
            <View style={styles.icalLinksList}>
              <Text style={styles.subsectionTitle}>Synchronisations actives</Text>
              {icalLinks.map((link) => (
                <View key={link.id} style={styles.icalLinkCard}>
                  <View style={styles.icalLinkInfo}>
                    <View style={styles.platformBadge}>
                      <Text style={styles.platformBadgeText}>
                        {link.platform.charAt(0).toUpperCase() + link.platform.slice(1)}
                      </Text>
                    </View>
                    {link.last_synced_at && (
                      <Text style={styles.syncDate}>
                        Dernière sync: {new Date(link.last_synced_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    )}
                  </View>
                  <View style={styles.icalLinkActions}>
                    <TouchableOpacity
                      style={[styles.syncButton, { marginRight: 12 }]}
                      onPress={() => handleSyncCalendar(link.platform)}
                      disabled={icalLoading}
                    >
                      <Ionicons name="refresh" size={18} color="#e67e22" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleRemoveICalLink(link.id)}
                      disabled={icalLoading}
                    >
                      <Ionicons name="trash-outline" size={18} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Légende */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Légende</Text>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.legendText}>Disponible</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#e67e22' }]} />
              <Text style={styles.legendText}>Réservé</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#e74c3c' }]} />
              <Text style={styles.legendText}>Bloqué manuellement</Text>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 18,
  },
  addICalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e67e22',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  addICalButtonText: {
    fontSize: 14,
    color: '#e67e22',
    fontWeight: '500',
    marginLeft: 8,
  },
  icalForm: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  platformSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  platformOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  platformOptionActive: {
    borderColor: '#e67e22',
    backgroundColor: '#fff5f0',
  },
  platformOptionText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  platformOptionTextActive: {
    color: '#e67e22',
  },
  icalLinksList: {
    marginTop: 16,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  icalLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  icalLinkInfo: {
    flex: 1,
  },
  platformBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
    marginBottom: 4,
  },
  platformBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textTransform: 'capitalize',
  },
  syncDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  icalLinkActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  dayCellAvailable: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  dayTextAvailable: {
    color: '#fff',
    fontWeight: '600',
  },
  exportUrlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  exportUrlText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  copyButtonText: {
    color: '#e67e22',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PropertyCalendarScreen;

