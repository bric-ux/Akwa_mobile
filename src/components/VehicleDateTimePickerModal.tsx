import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TRAVELER_COLORS } from '../constants/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VehicleDateTimePickerModalProps {
  visible: boolean;
  startDateTime: string | null;
  endDateTime: string | null;
  onClose: () => void;
  onConfirm: (startDateTime: string, endDateTime: string) => void;
}

const VehicleDateTimePickerModal: React.FC<VehicleDateTimePickerModalProps> = ({
  visible,
  startDateTime,
  endDateTime,
  onClose,
  onConfirm,
}) => {
  const [activeTab, setActiveTab] = useState<'start' | 'end'>('start');
  const [tempStartDate, setTempStartDate] = useState<Date>(() => {
    if (startDateTime) return new Date(startDateTime);
    const now = new Date();
    // Arrondir à l'heure supérieure (ex: 8h59 -> 9h, 10h30 -> 11h)
    const roundedHour = now.getHours() + 1;
    now.setHours(roundedHour, 0, 0, 0);
    return now;
  });
  const [tempEndDate, setTempEndDate] = useState<Date>(() => {
    if (endDateTime) return new Date(endDateTime);
    const now = new Date();
    // Arrondir à l'heure supérieure + 1 heure pour la date de fin
    const roundedHour = now.getHours() + 2;
    now.setHours(roundedHour, 0, 0, 0);
    return now;
  });

  const hoursScrollRef = useRef<ScrollView>(null);
  const minutesScrollRef = useRef<ScrollView>(null);
  const datesScrollRef = useRef<ScrollView>(null);

  // Générer les dates à afficher (30 jours à partir d'aujourd'hui)
  const generateDates = (): Date[] => {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Aujourd'hui
    dates.push(new Date(today));
    
    // 30 jours après
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };

  const dates = generateDates();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0]; // Seulement 00 (pas de sélection de minutes autres que 00)

  const currentDate = activeTab === 'start' ? tempStartDate : tempEndDate;
  const setCurrentDate = activeTab === 'start' ? setTempStartDate : setTempEndDate;

  const handleDateSelect = (date: Date) => {
    const newDate = new Date(date);
    // Toujours mettre les minutes à 00
    newDate.setHours(currentDate.getHours(), 0, 0, 0);
    
    // Si c'est la date de début et que c'est aujourd'hui, arrondir à l'heure supérieure
    if (activeTab === 'start') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDateOnly = new Date(date);
      selectedDateOnly.setHours(0, 0, 0, 0);
      
      if (selectedDateOnly.getTime() === today.getTime()) {
        // Si c'est aujourd'hui, arrondir à l'heure supérieure
        const now = new Date();
        const roundedHour = now.getHours() + 1;
        newDate.setHours(roundedHour, 0, 0, 0);
      }
      
      setTempStartDate(newDate);
      
      // Si la nouvelle date de début est après la date de fin, ajuster la date de fin
      const startDateOnly = new Date(newDate);
      startDateOnly.setHours(0, 0, 0, 0);
      const endDateOnly = new Date(tempEndDate);
      endDateOnly.setHours(0, 0, 0, 0);
      
      if (startDateOnly.getTime() >= endDateOnly.getTime()) {
        // Ajuster la date de fin au lendemain de la date de début
        const adjustedEndDate = new Date(newDate);
        adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);
        adjustedEndDate.setHours(tempEndDate.getHours(), 0, 0, 0);
        setTempEndDate(adjustedEndDate);
      }
    } else {
      // Si on sélectionne une date de fin
      setTempEndDate(newDate);
      
      // Si la nouvelle date de fin est avant la date de début, ajuster la date de début
      const startDateOnly = new Date(tempStartDate);
      startDateOnly.setHours(0, 0, 0, 0);
      const endDateOnly = new Date(newDate);
      endDateOnly.setHours(0, 0, 0, 0);
      
      if (endDateOnly.getTime() <= startDateOnly.getTime()) {
        // Ajuster la date de début au jour précédent de la date de fin
        const adjustedStartDate = new Date(newDate);
        adjustedStartDate.setDate(adjustedStartDate.getDate() - 1);
        adjustedStartDate.setHours(tempStartDate.getHours(), 0, 0, 0);
        setTempStartDate(adjustedStartDate);
      }
    }
  };

  const handleHourSelect = (hour: number) => {
    const newDate = new Date(currentDate);
    // Toujours mettre les minutes à 00
    newDate.setHours(hour, 0, 0, 0);
    
    // Vérifier si c'est aujourd'hui et si l'heure est dans le passé
    const now = new Date();
    const dateOnly = new Date(currentDate);
    dateOnly.setHours(0, 0, 0, 0);
    const todayOnly = new Date(now);
    todayOnly.setHours(0, 0, 0, 0);
    
    if (dateOnly.getTime() === todayOnly.getTime() && newDate.getTime() <= now.getTime()) {
      // Si c'est aujourd'hui et l'heure est passée, utiliser l'heure actuelle arrondie à l'heure supérieure
      const minTime = new Date(now);
      const roundedHour = minTime.getHours() + 1;
      minTime.setHours(roundedHour, 0, 0, 0);
      newDate.setTime(minTime.getTime());
    }
    
    if (activeTab === 'start') {
      setTempStartDate(newDate);
      // Si la date/heure de début est après la date de fin, ajuster la date de fin
      if (newDate.getTime() >= tempEndDate.getTime()) {
        const adjustedEndDate = new Date(newDate);
        adjustedEndDate.setHours(adjustedEndDate.getHours() + 1, 0, 0, 0);
        setTempEndDate(adjustedEndDate);
      }
    } else {
      setTempEndDate(newDate);
      // Si la date/heure de fin est avant la date de début, ajuster la date de début
      if (newDate.getTime() <= tempStartDate.getTime()) {
        const adjustedStartDate = new Date(newDate);
        adjustedStartDate.setHours(adjustedStartDate.getHours() - 1, 0, 0, 0);
        setTempStartDate(adjustedStartDate);
      }
    }
  };

  const handleMinuteSelect = (minute: number) => {
    // Les minutes sont toujours à 00, donc on ne fait rien ici
    // Cette fonction est gardée pour la compatibilité mais ne devrait pas être appelée
    // car il n'y a qu'une seule option (00)
  };

  const formatDate = (date: Date): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToFormat = new Date(date);
    dateToFormat.setHours(0, 0, 0, 0);
    
    if (dateToFormat.getTime() === today.getTime()) {
      return "Aujourd'hui";
    }
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateToFormat.getTime() === tomorrow.getTime()) {
      return "Demain";
    }
    
    const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
    const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const formatTime = (date: Date): string => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const calculateDuration = (): { days: number; hours: number } => {
    const diff = tempEndDate.getTime() - tempStartDate.getTime();
    const totalHours = Math.ceil(diff / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return { days, hours };
  };

  const handleConfirm = () => {
    // S'assurer que les minutes sont toujours à 00
    const finalStartDate = new Date(tempStartDate);
    finalStartDate.setMinutes(0, 0, 0);
    
    const finalEndDate = new Date(tempEndDate);
    finalEndDate.setMinutes(0, 0, 0);
    
    // Vérification finale : s'assurer que la date de fin est après la date de début
    const startDateOnly = new Date(finalStartDate);
    startDateOnly.setHours(0, 0, 0, 0);
    const endDateOnly = new Date(finalEndDate);
    endDateOnly.setHours(0, 0, 0, 0);
    
    if (endDateOnly.getTime() <= startDateOnly.getTime()) {
      // Si la date de fin est avant ou égale à la date de début, ajuster
      finalEndDate.setTime(finalStartDate.getTime());
      finalEndDate.setHours(finalEndDate.getHours() + 1, 0, 0, 0);
    }
    
    // Vérifier que la date de début n'est pas dans le passé
    const now = new Date();
    if (finalStartDate.getTime() < now.getTime()) {
      // Arrondir à l'heure supérieure
      const roundedHour = now.getHours() + 1;
      finalStartDate.setTime(now.getTime());
      finalStartDate.setHours(roundedHour, 0, 0, 0);
    }
    
    onConfirm(finalStartDate.toISOString(), finalEndDate.toISOString());
    onClose();
  };

  // Scroll vers la date/heure sélectionnée quand on change d'onglet
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        // Trouver l'index de la date sélectionnée
        const dateIndex = dates.findIndex(date => {
          return date.getDate() === currentDate.getDate() &&
                 date.getMonth() === currentDate.getMonth() &&
                 date.getFullYear() === currentDate.getFullYear();
        });
        
        const hourIndex = currentDate.getHours();
        
        if (datesScrollRef.current && dateIndex >= 0) {
          datesScrollRef.current.scrollTo({ y: dateIndex * 58, animated: true });
        }
        if (hoursScrollRef.current && hourIndex >= 0) {
          hoursScrollRef.current.scrollTo({ y: hourIndex * 58, animated: true });
        }
        // Plus besoin de scroller les minutes car c'est toujours 00
      }, 100);
    }
  }, [currentDate, visible, activeTab]);

  if (!visible) return null;

  const duration = calculateDuration();
  const durationText = duration.days > 0 
    ? `${duration.days} jour${duration.days > 1 ? 's' : ''}${duration.hours > 0 ? ` et ${duration.hours}h` : ''}`
    : `${duration.hours}h`;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={styles.container}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          {/* Onglets Début/Fin - Style arrondi comme dans l'image */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'start' && styles.tabButtonActive]}
              onPress={() => setActiveTab('start')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'start' && styles.tabButtonTextActive]}>
                Début
              </Text>
              <Text style={[styles.tabButtonSubtext, activeTab === 'start' && styles.tabButtonSubtextActive]}>
                {formatDate(tempStartDate)} à {formatTime(tempStartDate)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'end' && styles.tabButtonActive]}
              onPress={() => setActiveTab('end')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'end' && styles.tabButtonTextActive]}>
                Fin
              </Text>
              <Text style={[styles.tabButtonSubtext, activeTab === 'end' && styles.tabButtonSubtextActive]}>
                {formatDate(tempEndDate)} à {formatTime(tempEndDate)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Trois colonnes scrollables : Date, Heures, Minutes */}
          <View style={styles.pickerContainer}>
            {/* Colonne Date */}
            <View style={styles.pickerColumn}>
              <ScrollView
                ref={datesScrollRef}
                style={styles.pickerScroll}
                contentContainerStyle={styles.pickerScrollContent}
                showsVerticalScrollIndicator={false}
                snapToInterval={58}
                decelerationRate="fast"
              >
                {dates.map((date, index) => {
                  const isDateSelected = 
                    date.getDate() === currentDate.getDate() &&
                    date.getMonth() === currentDate.getMonth() &&
                    date.getFullYear() === currentDate.getFullYear();
                  
                  // Vérifier si la date est dans le passé (pour l'onglet début)
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const dateToCheck = new Date(date);
                  dateToCheck.setHours(0, 0, 0, 0);
                  const isPast = dateToCheck.getTime() < today.getTime();
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.pickerItem,
                        isDateSelected && styles.pickerItemSelected,
                        isPast && activeTab === 'start' && styles.pickerItemDisabled
                      ]}
                      onPress={() => {
                        if (!(isPast && activeTab === 'start')) {
                          handleDateSelect(date);
                        }
                      }}
                      disabled={isPast && activeTab === 'start'}
                    >
                      <Text style={[
                        styles.pickerText,
                        isDateSelected && styles.pickerTextSelected,
                        isPast && activeTab === 'start' && styles.pickerTextDisabled
                      ]}>
                        {formatDate(date)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            
            {/* Colonne Heures */}
            <View style={styles.pickerColumn}>
              <ScrollView
                ref={hoursScrollRef}
                style={styles.pickerScroll}
                contentContainerStyle={styles.pickerScrollContent}
                showsVerticalScrollIndicator={false}
                snapToInterval={58}
                decelerationRate="fast"
              >
                {hours.map((hour) => {
                  const isHourSelected = currentDate.getHours() === hour;
                  return (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.pickerItem,
                        isHourSelected && styles.pickerItemSelected
                      ]}
                      onPress={() => handleHourSelect(hour)}
                    >
                      <Text style={[
                        styles.pickerText,
                        isHourSelected && styles.pickerTextSelected
                      ]}>
                        {hour.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            
            {/* Colonne Minutes - seulement 00 */}
            <View style={styles.pickerColumn}>
              <View style={styles.minutesDisplay}>
                <Text style={styles.minutesDisplayText}>
                  00
                </Text>
              </View>
            </View>
          </View>

          {/* Bouton de confirmation */}
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmButtonText}>
              Rechercher pour {durationText}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  safeArea: {
    flex: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tabButtonActive: {
    backgroundColor: '#f0f0f0',
    borderColor: TRAVELER_COLORS.primary,
    borderWidth: 1.5,
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginBottom: 4,
  },
  tabButtonTextActive: {
    color: TRAVELER_COLORS.primary,
  },
  tabButtonSubtext: {
    fontSize: 13,
    color: '#999',
  },
  tabButtonSubtextActive: {
    color: '#333',
    fontWeight: '500',
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingVertical: 20,
    gap: 12,
    flex: 1,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 120,
  },
  pickerScroll: {
    height: 200,
    width: '100%',
  },
  pickerScrollContent: {
    alignItems: 'center',
    paddingVertical: 75,
  },
  pickerItem: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 8,
  },
  pickerItemSelected: {
    backgroundColor: TRAVELER_COLORS.primary,
    borderColor: TRAVELER_COLORS.primary,
  },
  pickerItemDisabled: {
    opacity: 0.4,
    backgroundColor: '#f0f0f0',
  },
  pickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  pickerTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  pickerTextDisabled: {
    color: '#999',
  },
  minutesDisplay: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 8,
  },
  minutesDisplayText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: TRAVELER_COLORS.primary,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VehicleDateTimePickerModal;
