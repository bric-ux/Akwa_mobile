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
    now.setHours(2, 0, 0, 0);
    return now;
  });
  const [tempEndDate, setTempEndDate] = useState<Date>(() => {
    if (endDateTime) return new Date(endDateTime);
    const now = new Date();
    now.setHours(3, 0, 0, 0);
    return now;
  });

  const hoursScrollRef = useRef<ScrollView>(null);
  const minutesScrollRef = useRef<ScrollView>(null);

  // Générer les dates à afficher (7 jours avant et après aujourd'hui)
  const generateDates = (): Date[] => {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 7 jours avant
    for (let i = 7; i > 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date);
    }
    
    // Aujourd'hui
    dates.push(new Date(today));
    
    // 14 jours après
    for (let i = 1; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };

  const dates = generateDates();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  const currentDate = activeTab === 'start' ? tempStartDate : tempEndDate;
  const setCurrentDate = activeTab === 'start' ? setTempStartDate : setTempEndDate;

  const handleDateSelect = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(currentDate.getHours(), currentDate.getMinutes(), 0, 0);
    setCurrentDate(newDate);
  };

  const handleHourSelect = (hour: number) => {
    const newDate = new Date(currentDate);
    newDate.setHours(hour, currentDate.getMinutes(), 0, 0);
    setCurrentDate(newDate);
  };

  const handleMinuteSelect = (minute: number) => {
    const newDate = new Date(currentDate);
    newDate.setMinutes(minute, 0, 0);
    setCurrentDate(newDate);
  };

  const formatDate = (date: Date): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToFormat = new Date(date);
    dateToFormat.setHours(0, 0, 0, 0);
    
    if (dateToFormat.getTime() === today.getTime()) {
      return "Aujourd'hui";
    }
    
    const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
    const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const formatTime = (date: Date): string => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const calculateDuration = (): number => {
    const diff = tempEndDate.getTime() - tempStartDate.getTime();
    const hours = Math.ceil(diff / (1000 * 60 * 60));
    return hours;
  };

  const handleConfirm = () => {
    onConfirm(tempStartDate.toISOString(), tempEndDate.toISOString());
    onClose();
  };

  // Scroll vers l'heure sélectionnée quand on change de date
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        const hourIndex = currentDate.getHours();
        const minuteIndex = minutes.indexOf(currentDate.getMinutes());
        if (hoursScrollRef.current) {
          hoursScrollRef.current.scrollTo({ y: hourIndex * 50, animated: true });
        }
        if (minutesScrollRef.current) {
          minutesScrollRef.current.scrollTo({ y: minuteIndex * 50, animated: true });
        }
      }, 100);
    }
  }, [currentDate, visible]);

  if (!visible) return null;

  const duration = calculateDuration();

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={styles.container}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          {/* Onglets Début/Fin */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'start' && styles.tabActive]}
              onPress={() => setActiveTab('start')}
            >
              <Text style={[styles.tabText, activeTab === 'start' && styles.tabTextActive]}>
                Début
              </Text>
              <Text style={[styles.tabSubtext, activeTab === 'start' && styles.tabSubtextActive]}>
                {formatDate(tempStartDate)} à {formatTime(tempStartDate)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'end' && styles.tabActive]}
              onPress={() => setActiveTab('end')}
            >
              <Text style={[styles.tabText, activeTab === 'end' && styles.tabTextActive]}>
                Fin
              </Text>
              <Text style={[styles.tabSubtext, activeTab === 'end' && styles.tabSubtextActive]}>
                {formatDate(tempEndDate)} à {formatTime(tempEndDate)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Liste scrollable des dates avec heures/minutes à droite */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {dates.map((date, index) => {
              const isDateSelected = 
                date.getDate() === currentDate.getDate() &&
                date.getMonth() === currentDate.getMonth() &&
                date.getFullYear() === currentDate.getFullYear();
              
              return (
                <View key={index} style={styles.dateRow}>
                  <TouchableOpacity
                    style={[styles.dateItem, isDateSelected && styles.dateItemSelected]}
                    onPress={() => handleDateSelect(date)}
                  >
                    <Text style={[styles.dateText, isDateSelected && styles.dateTextSelected]}>
                      {formatDate(date)}
                    </Text>
                  </TouchableOpacity>
                  
                  {/* Heures et minutes à droite - seulement si la date est sélectionnée */}
                  {isDateSelected && (
                    <View style={styles.timeContainer}>
                      <ScrollView
                        ref={hoursScrollRef}
                        style={styles.timeScroll}
                        contentContainerStyle={styles.timeScrollContent}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled={true}
                      >
                        {hours.map((hour) => (
                          <TouchableOpacity
                            key={hour}
                            style={[
                              styles.timeItem,
                              currentDate.getHours() === hour && styles.timeItemSelected
                            ]}
                            onPress={() => handleHourSelect(hour)}
                          >
                            <Text style={[
                              styles.timeText,
                              currentDate.getHours() === hour && styles.timeTextSelected
                            ]}>
                              {hour.toString().padStart(2, '0')}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <ScrollView
                        ref={minutesScrollRef}
                        style={styles.timeScroll}
                        contentContainerStyle={styles.timeScrollContent}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled={true}
                      >
                        {minutes.map((minute) => (
                          <TouchableOpacity
                            key={minute}
                            style={[
                              styles.timeItem,
                              currentDate.getMinutes() === minute && styles.timeItemSelected
                            ]}
                            onPress={() => handleMinuteSelect(minute)}
                          >
                            <Text style={[
                              styles.timeText,
                              currentDate.getMinutes() === minute && styles.timeTextSelected
                            ]}>
                              {minute.toString().padStart(2, '0')}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Bouton de confirmation */}
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmButtonText}>
              Rechercher pour {duration} h
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
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: TRAVELER_COLORS.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginBottom: 4,
  },
  tabTextActive: {
    color: TRAVELER_COLORS.primary,
  },
  tabSubtext: {
    fontSize: 13,
    color: '#999',
  },
  tabSubtextActive: {
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 60,
  },
  dateItem: {
    flex: 1,
  },
  dateItemSelected: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  dateTextSelected: {
    fontWeight: '600',
    color: '#333',
  },
  timeContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  timeScroll: {
    maxHeight: 200,
    width: 50,
  },
  timeScrollContent: {
    paddingVertical: 50,
  },
  timeItem: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  timeItemSelected: {
    backgroundColor: TRAVELER_COLORS.primary,
    borderColor: TRAVELER_COLORS.primary,
  },
  timeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  timeTextSelected: {
    color: '#fff',
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
