import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAvailabilityCalendar } from '../hooks/useAvailabilityCalendar';

const { width } = Dimensions.get('window');

interface AvailabilityCalendarProps {
  propertyId: string;
  selectedCheckIn?: Date;
  selectedCheckOut?: Date;
  onDateSelect: (checkIn: Date | null, checkOut: Date | null) => void;
  onClose: () => void;
}

const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  propertyId,
  selectedCheckIn,
  selectedCheckOut,
  onDateSelect,
  onClose,
}) => {
  const { isDateUnavailable, getUnavailableReason, loading } = useAvailabilityCalendar(propertyId);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tempCheckIn, setTempCheckIn] = useState<Date | null>(selectedCheckIn || null);
  const [tempCheckOut, setTempCheckOut] = useState<Date | null>(selectedCheckOut || null);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Ajouter les jours vides du début du mois
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Ajouter les jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const isDateSelected = (date: Date) => {
    if (!tempCheckIn && !tempCheckOut) return false;
    if (tempCheckIn && tempCheckOut) {
      return date >= tempCheckIn && date <= tempCheckOut;
    }
    return tempCheckIn?.getTime() === date.getTime() || tempCheckOut?.getTime() === date.getTime();
  };

  const isDateInRange = (date: Date) => {
    if (!tempCheckIn || !tempCheckOut) return false;
    return date > tempCheckIn && date < tempCheckOut;
  };

  const isDateStart = (date: Date) => {
    return tempCheckIn?.getTime() === date.getTime();
  };

  const isDateEnd = (date: Date) => {
    return tempCheckOut?.getTime() === date.getTime();
  };

  const isPastDate = (date: Date) => {
    const today = new Date();
    // Réinitialiser les heures pour comparer seulement les dates
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today;
  };

  const handleDatePress = (date: Date) => {
    if (isDateUnavailable(date) || isPastDate(date)) return;

    if (!tempCheckIn || (tempCheckIn && tempCheckOut)) {
      // Nouvelle sélection
      setTempCheckIn(date);
      setTempCheckOut(null);
    } else if (tempCheckIn && !tempCheckOut) {
      // Sélection de la date de fin - permettre le même jour
      if (date >= tempCheckIn) {
        setTempCheckOut(date);
      } else {
        setTempCheckIn(date);
        setTempCheckOut(null);
      }
    }
  };

  const handleConfirm = () => {
    // Si pas de date de départ, utiliser la date d'arrivée + 1 jour
    const checkOut = tempCheckOut || (tempCheckIn ? new Date(tempCheckIn.getTime() + 24 * 60 * 60 * 1000) : null);
    onDateSelect(tempCheckIn, checkOut);
    onClose();
  };

  const handleClear = () => {
    setTempCheckIn(null);
    setTempCheckOut(null);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getDayStyle = (date: Date) => {
    if (isDateUnavailable(date)) {
      return [styles.day, styles.unavailableDay];
    }
    if (isDateSelected(date)) {
      return [styles.day, styles.selectedDay];
    }
    if (isDateInRange(date)) {
      return [styles.day, styles.rangeDay];
    }
    if (isDateStart(date) || isDateEnd(date)) {
      return [styles.day, styles.rangeEndDay];
    }
    return [styles.day, styles.availableDay];
  };

  const days = getDaysInMonth(currentMonth);
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Sélectionner les dates</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.monthHeader}>
          <TouchableOpacity onPress={goToPreviousMonth} style={styles.monthButton}>
            <Ionicons name="chevron-back" size={20} color="#2E7D32" />
          </TouchableOpacity>
          
          <Text style={styles.monthTitle}>
            {formatMonthYear(currentMonth)}
          </Text>
          
          <TouchableOpacity onPress={goToNextMonth} style={styles.monthButton}>
            <Ionicons name="chevron-forward" size={20} color="#2E7D32" />
          </TouchableOpacity>
        </View>

        <View style={styles.calendar}>
          <View style={styles.dayNamesRow}>
            {dayNames.map((dayName, index) => (
              <Text key={index} style={styles.dayName}>
                {dayName}
              </Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {days.map((day, index) => {
              if (!day) {
                return <View key={index} style={styles.emptyDay} />;
              }

              const isUnavailable = isDateUnavailable(day);
              const isPast = isPastDate(day);
              const reason = isUnavailable ? getUnavailableReason(day) : (isPast ? 'Passé' : null);

              return (
                <TouchableOpacity
                  key={index}
                  style={getDayStyle(day)}
                  onPress={() => handleDatePress(day)}
                  disabled={isUnavailable || isPast}
                >
                  <Text style={[
                    styles.dayText,
                    (isUnavailable || isPast) && styles.unavailableDayText,
                    isDateSelected(day) && styles.selectedDayText,
                    isDateInRange(day) && styles.rangeDayText,
                    (isDateStart(day) || isDateEnd(day)) && styles.rangeEndDayText
                  ]}>
                    {day.getDate()}
                  </Text>
                  {reason && (
                    <Text style={styles.reasonText} numberOfLines={1}>
                      {reason}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, styles.availableColor]} />
            <Text style={styles.legendText}>Disponible</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, styles.unavailableColor]} />
            <Text style={styles.legendText}>Indisponible</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, styles.pastColor]} />
            <Text style={styles.legendText}>Passé</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Effacer</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={handleConfirm} 
          style={[styles.confirmButton, !tempCheckIn && styles.confirmButtonDisabled]}
          disabled={!tempCheckIn}
        >
          <Text style={styles.confirmButtonText}>Confirmer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  monthButton: {
    padding: 10,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  calendar: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyDay: {
    width: width / 7 - 10,
    height: 50,
    margin: 2,
  },
  day: {
    width: width / 7 - 10,
    height: 50,
    margin: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  availableDay: {
    backgroundColor: '#fff',
  },
  selectedDay: {
    backgroundColor: '#2E7D32',
  },
  rangeDay: {
    backgroundColor: '#e8f5e8',
  },
  rangeEndDay: {
    backgroundColor: '#2E7D32',
  },
  unavailableDay: {
    backgroundColor: '#f5f5f5',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  rangeDayText: {
    color: '#2E7D32',
  },
  rangeEndDayText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  unavailableDayText: {
    color: '#ccc',
  },
  reasonText: {
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  availableColor: {
    backgroundColor: '#2E7D32',
  },
  unavailableColor: {
    backgroundColor: '#ccc',
  },
  pastColor: {
    backgroundColor: '#f5f5f5',
  },
  legendText: {
    fontSize: 14,
    color: '#666',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  confirmButton: {
    flex: 2,
    paddingVertical: 15,
    borderRadius: 10,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default AvailabilityCalendar;
