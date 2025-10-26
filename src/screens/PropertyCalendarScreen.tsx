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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAvailabilityCalendar, useBlockedDates, BlockedDate } from '../hooks/useAvailabilityCalendar';
import { useAuth } from '../services/AuthContext';

const PropertyCalendarScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { propertyId } = route.params as { propertyId: string };
  
  const { unavailableDates, loading: calendarLoading, refetch, isDateUnavailable } = useAvailabilityCalendar(propertyId);
  const { getBlockedDates, blockDates, unblockDates, loading: blockedLoading } = useBlockedDates();
  
  const [blockedDatesList, setBlockedDatesList] = useState<BlockedDate[]>([]);
  const [selectedRange, setSelectedRange] = useState<{ from?: Date; to?: Date }>({});
  const [reason, setReason] = useState('');
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (propertyId) {
      loadBlockedDates();
    }
  }, [propertyId]);

  const loadBlockedDates = async () => {
    const dates = await getBlockedDates(propertyId);
    setBlockedDatesList(dates);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateForAPI = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDatePress = (date: Date) => {
    if (isDateUnavailable(date)) {
      Alert.alert('Date indisponible', 'Cette date est déjà réservée ou bloquée');
      return;
    }

    if (isSelectingRange && selectedRange.from && !selectedRange.to) {
      // Deuxième clic : définir la date de fin pour créer une plage
      const startDate = selectedRange.from;
      const endDate = date;
      
      // Si c'est la même date, créer une date unique
      if (startDate.getTime() === endDate.getTime()) {
        setSelectedRange({ from: startDate, to: startDate });
      } else {
        // S'assurer que la date de fin est après la date de début
        if (endDate >= startDate) {
          setSelectedRange({ from: startDate, to: endDate });
        } else {
          setSelectedRange({ from: endDate, to: startDate });
        }
      }
      setIsSelectingRange(false);
    } else {
      // Premier clic : définir la date de début
      setSelectedRange({ from: date, to: undefined });
      setIsSelectingRange(true);
    }
  };

  const handleBlockDates = async () => {
    if (!selectedRange.from || !selectedRange.to) {
      Alert.alert('Erreur', 'Veuillez sélectionner une plage de dates');
      return;
    }

    const result = await blockDates(
      propertyId,
      formatDateForAPI(selectedRange.from),
      formatDateForAPI(selectedRange.to),
      reason || undefined
    );

    if (result.success) {
      Alert.alert('Succès', 'Dates bloquées avec succès');
      setSelectedRange({});
      setReason('');
      setIsSelectingRange(false);
      await loadBlockedDates();
      await refetch();
    } else {
      Alert.alert('Erreur', result.error || 'Impossible de bloquer ces dates');
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
          onPress: async () => {
            const result = await unblockDates(id);
            if (result.success) {
              Alert.alert('Succès', 'Dates débloquées avec succès');
              await loadBlockedDates();
              await refetch();
            } else {
              Alert.alert('Erreur', result.error || 'Impossible de débloquer ces dates');
            }
          },
        },
      ]
    );
  };

  const generateCalendarDays = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Ajouter les jours vides du mois précédent
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Ajouter les jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push(date);
    }
    
    return days;
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const days = generateCalendarDays(year, month);
    
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            style={styles.navButton}
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          
          <Text style={styles.monthTitle}>
            {monthNames[month]} {year}
          </Text>
          
          <TouchableOpacity
            onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            style={styles.navButton}
          >
            <Ionicons name="chevron-forward" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <View style={styles.weekDays}>
          {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((day) => (
            <Text key={day} style={styles.weekDay}>{day}</Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {days.map((day, index) => {
            if (!day) {
              return <View key={index} style={styles.dayCell} />;
            }

            const isUnavailable = isDateUnavailable(day);
            const isPast = day < new Date();
            const isSelected = selectedRange.from && selectedRange.to && 
              day >= selectedRange.from && day <= selectedRange.to;
            const isStart = selectedRange.from && day.getTime() === selectedRange.from.getTime();
            const isEnd = selectedRange.to && day.getTime() === selectedRange.to.getTime();

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  isUnavailable && styles.unavailableDay,
                  isPast && styles.pastDay,
                  isSelected && styles.selectedDay,
                  isStart && styles.startDay,
                  isEnd && styles.endDay,
                ]}
                onPress={() => handleDatePress(day)}
                disabled={isUnavailable || isPast}
              >
                <Text style={[
                  styles.dayText,
                  isUnavailable && styles.unavailableText,
                  isPast && styles.pastText,
                  isSelected && styles.selectedText,
                ]}>
                  {day.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderBlockedDatesList = () => (
    <View style={styles.blockedDatesContainer}>
      <Text style={styles.sectionTitle}>Dates bloquées</Text>
      {blockedDatesList.length === 0 ? (
        <Text style={styles.emptyText}>Aucune date bloquée</Text>
      ) : (
        blockedDatesList.map((blocked) => (
          <View key={blocked.id} style={styles.blockedDateItem}>
            <View style={styles.blockedDateInfo}>
              <Text style={styles.blockedDateRange}>
                {formatDate(new Date(blocked.start_date))} - {formatDate(new Date(blocked.end_date))}
              </Text>
              {blocked.reason && (
                <Text style={styles.blockedDateReason}>{blocked.reason}</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.unblockButton}
              onPress={() => handleUnblock(blocked.id)}
            >
              <Ionicons name="close-circle" size={20} color="#e74c3c" />
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Connexion requise</Text>
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
        <Text style={styles.headerTitle}>Calendrier de disponibilité</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            loadBlockedDates();
            refetch();
          }}
        >
          <Ionicons name="refresh" size={24} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>💡 Instructions</Text>
          <Text style={styles.instructionsText}>
            • Cliquez sur une date pour commencer la sélection{'\n'}
            • Cliquez sur une autre date pour terminer la plage{'\n'}
            • Les dates rouges sont indisponibles (réservées ou bloquées){'\n'}
            • Les dates grises sont dans le passé
          </Text>
        </View>

        {/* Calendrier */}
        {renderCalendar()}

        {/* Sélection en cours */}
        {isSelectingRange && (
          <View style={styles.selectionContainer}>
            <Text style={styles.selectionText}>
              Sélection en cours : Cliquez sur la date de fin pour compléter la plage
            </Text>
          </View>
        )}

        {/* Formulaire de blocage */}
        {selectedRange.from && selectedRange.to && (
          <View style={styles.blockFormContainer}>
            <Text style={styles.sectionTitle}>Bloquer les dates sélectionnées</Text>
            <Text style={styles.selectedRangeText}>
              Du {formatDate(selectedRange.from)} au {formatDate(selectedRange.to)}
            </Text>
            
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Raison du blocage (optionnel)"
              multiline
              numberOfLines={2}
            />
            
            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setSelectedRange({});
                  setReason('');
                  setIsSelectingRange(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.blockButton}
                onPress={handleBlockDates}
                disabled={blockedLoading}
              >
                {blockedLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.blockButtonText}>Bloquer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Liste des dates bloquées */}
        {renderBlockedDatesList()}
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
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    textAlign: 'center',
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
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  instructionsContainer: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
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
    marginBottom: 20,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  weekDays: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  dayText: {
    fontSize: 14,
    color: '#333',
  },
  unavailableDay: {
    backgroundColor: '#ffeaea',
  },
  unavailableText: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  pastDay: {
    backgroundColor: '#f8f9fa',
  },
  pastText: {
    color: '#999',
  },
  selectedDay: {
    backgroundColor: '#e3f2fd',
  },
  selectedText: {
    color: '#1976d2',
    fontWeight: 'bold',
  },
  startDay: {
    backgroundColor: '#2E7D32',
  },
  endDay: {
    backgroundColor: '#2E7D32',
  },
  selectionContainer: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  selectionText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    fontWeight: '500',
  },
  blockFormContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
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
  selectedRangeText: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '500',
    marginBottom: 15,
  },
  reasonInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  blockButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 10,
    borderRadius: 8,
    backgroundColor: '#e74c3c',
    alignItems: 'center',
  },
  blockButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  blockedDatesContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  blockedDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  blockedDateInfo: {
    flex: 1,
  },
  blockedDateRange: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  blockedDateReason: {
    fontSize: 14,
    color: '#666',
  },
  unblockButton: {
    padding: 8,
  },
});

export default PropertyCalendarScreen;


