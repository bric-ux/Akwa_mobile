import React, { useState, useEffect } from 'react';
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
  selectedCheckIn?: Date | null;
  selectedCheckOut?: Date | null;
  onDateSelect: (checkIn: Date | null, checkOut: Date | null) => void;
  onClose: () => void;
  mode?: 'checkIn' | 'checkOut' | 'both'; // Mode de sélection : une seule date ou les deux
  showHeader?: boolean; // Afficher ou non le header du calendrier
  excludeBookingId?: string; // ID de la réservation à exclure (pour modification)
  excludeBookingDates?: { checkIn: string; checkOut: string }; // Dates de la réservation actuelle (pour permettre sélection)
}

const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  propertyId,
  selectedCheckIn,
  selectedCheckOut,
  onDateSelect,
  onClose,
  mode = 'both',
  showHeader = true,
  excludeBookingId,
  excludeBookingDates,
}) => {
  const { isDateUnavailable, unavailableDates, loading, isDateRangeUnavailable } = useAvailabilityCalendar(propertyId, excludeBookingId, excludeBookingDates);
  // Initialiser le mois avec la date appropriée selon le mode
  const getInitialMonth = (): Date => {
    // Si on est en mode checkOut, utiliser selectedCheckOut
    if (mode === 'checkOut' && selectedCheckOut) {
      return new Date(selectedCheckOut.getFullYear(), selectedCheckOut.getMonth(), 1);
    }
    // Sinon, utiliser selectedCheckIn ou selectedCheckOut
    if (selectedCheckIn) {
      return new Date(selectedCheckIn.getFullYear(), selectedCheckIn.getMonth(), 1);
    }
    if (selectedCheckOut) {
      return new Date(selectedCheckOut.getFullYear(), selectedCheckOut.getMonth(), 1);
    }
    return new Date();
  };
  const [currentMonth, setCurrentMonth] = useState(getInitialMonth());
  const [tempCheckIn, setTempCheckIn] = useState<Date | null>(selectedCheckIn || null);
  const [tempCheckOut, setTempCheckOut] = useState<Date | null>(selectedCheckOut || null);
  
  // Mettre à jour le mois initial quand les dates ou le mode changent
  useEffect(() => {
    if (mode === 'checkOut' && selectedCheckOut) {
      const checkOutMonth = new Date(selectedCheckOut.getFullYear(), selectedCheckOut.getMonth(), 1);
      setCurrentMonth(checkOutMonth);
    } else if (selectedCheckIn) {
      const checkInMonth = new Date(selectedCheckIn.getFullYear(), selectedCheckIn.getMonth(), 1);
      setCurrentMonth(checkInMonth);
    } else if (selectedCheckOut) {
      const checkOutMonth = new Date(selectedCheckOut.getFullYear(), selectedCheckOut.getMonth(), 1);
      setCurrentMonth(checkOutMonth);
    }
  }, [selectedCheckIn, selectedCheckOut, mode]);

  // Fonction pour normaliser une date à minuit (évite les problèmes de fuseau horaire)
  const normalizeDate = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

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
    
    // Ajouter les jours du mois - normaliser à minuit
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      days.push(normalizeDate(dateObj));
    }
    
    return days;
  };

  const isDateSelected = (date: Date) => {
    if (!tempCheckIn && !tempCheckOut) return false;
    const normalizedDate = normalizeDate(date);
    const normalizedCheckIn = tempCheckIn ? normalizeDate(tempCheckIn) : null;
    const normalizedCheckOut = tempCheckOut ? normalizeDate(tempCheckOut) : null;
    
    if (normalizedCheckIn && normalizedCheckOut) {
      return normalizedDate >= normalizedCheckIn && normalizedDate <= normalizedCheckOut;
    }
    return normalizedCheckIn?.getTime() === normalizedDate.getTime() || normalizedCheckOut?.getTime() === normalizedDate.getTime();
  };

  const isDateInRange = (date: Date) => {
    if (!tempCheckIn || !tempCheckOut) return false;
    const normalizedDate = normalizeDate(date);
    const normalizedCheckIn = normalizeDate(tempCheckIn);
    const normalizedCheckOut = normalizeDate(tempCheckOut);
    return normalizedDate > normalizedCheckIn && normalizedDate < normalizedCheckOut;
  };

  const isDateStart = (date: Date) => {
    if (!tempCheckIn) return false;
    const normalizedDate = normalizeDate(date);
    const normalizedCheckIn = normalizeDate(tempCheckIn);
    return normalizedCheckIn.getTime() === normalizedDate.getTime();
  };

  const isDateEnd = (date: Date) => {
    if (!tempCheckOut) return false;
    const normalizedDate = normalizeDate(date);
    const normalizedCheckOut = normalizeDate(tempCheckOut);
    return normalizedCheckOut.getTime() === normalizedDate.getTime();
  };

  const getUnavailableReason = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const unavailablePeriod = unavailableDates.find(({ start_date, end_date }) => {
      return dateStr >= start_date && dateStr <= end_date;
    });
    
    return unavailablePeriod?.reason || 'Indisponible';
  };

  const isPastDate = (date: Date) => {
    const today = new Date();
    // Réinitialiser les heures pour comparer seulement les dates
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today;
  };

  const isDateBeforeCheckIn = (date: Date) => {
    if (mode !== 'checkOut') return false;
    const checkInToCompare = selectedCheckIn || tempCheckIn;
    if (!checkInToCompare) return false;
    const normalizedDate = normalizeDate(date);
    const normalizedCheckIn = normalizeDate(checkInToCompare);
    return normalizedDate <= normalizedCheckIn;
  };

  const handleDatePress = (date: Date) => {
    if (isDateUnavailable(date) || isPastDate(date) || isDateBeforeCheckIn(date)) return;

    // Normaliser la date sélectionnée
    const normalizedDate = normalizeDate(date);

    if (mode === 'checkIn') {
      // Mode check-in uniquement : sélectionner directement la date d'arrivée
      setTempCheckIn(normalizedDate);
      setTempCheckOut(null);
      // Confirmer automatiquement
      onDateSelect(normalizedDate, null);
      onClose();
    } else if (mode === 'checkOut') {
      // Mode check-out uniquement : sélectionner directement la date de départ
      // Vérifier que la date est après check-in
      const checkInToCompare = selectedCheckIn || tempCheckIn;
      if (checkInToCompare) {
        const normalizedCheckIn = normalizeDate(checkInToCompare);
        if (normalizedDate > normalizedCheckIn) {
          setTempCheckOut(normalizedDate);
          // Confirmer automatiquement
          onDateSelect(null, normalizedDate);
          onClose();
        }
      } else {
        setTempCheckOut(normalizedDate);
        // Confirmer automatiquement
        onDateSelect(null, normalizedDate);
        onClose();
      }
    } else {
      // Mode both : sélectionner les deux dates
      if (!tempCheckIn || (tempCheckIn && tempCheckOut)) {
        // Nouvelle sélection
        setTempCheckIn(normalizedDate);
        setTempCheckOut(null);
      } else if (tempCheckIn && !tempCheckOut) {
        // Sélection de la date de fin - permettre le même jour
        const normalizedCheckIn = normalizeDate(tempCheckIn);
        if (normalizedDate >= normalizedCheckIn) {
          // Vérifier si la plage complète chevauche une période indisponible
          if (isDateRangeUnavailable && isDateRangeUnavailable(tempCheckIn, normalizedDate)) {
            // La plage chevauche une période indisponible, ne pas permettre la sélection
            return;
          }
          setTempCheckOut(normalizedDate);
        } else {
          setTempCheckIn(normalizedDate);
          setTempCheckOut(null);
        }
      }
    }
  };

  const handleConfirm = () => {
    // Normaliser les dates avant de les passer
    const normalizedCheckIn = tempCheckIn ? normalizeDate(tempCheckIn) : null;
    const normalizedCheckOut = tempCheckOut ? normalizeDate(tempCheckOut) : null;
    
    if (mode === 'checkIn' && normalizedCheckIn) {
      // Mode check-in : passer seulement la date d'arrivée
      onDateSelect(normalizedCheckIn, null);
    } else if (mode === 'checkOut' && normalizedCheckOut) {
      // Mode check-out : passer seulement la date de départ
      onDateSelect(null, normalizedCheckOut);
    } else {
      // Mode both : passer les deux dates
      // Si pas de date de départ, utiliser la date d'arrivée + 1 jour
      const checkOut = normalizedCheckOut || 
        (normalizedCheckIn ? normalizeDate(new Date(normalizedCheckIn.getTime() + 24 * 60 * 60 * 1000)) : null);
      
      // Vérifier si la plage complète chevauche une période indisponible
      if (normalizedCheckIn && checkOut && isDateRangeUnavailable && isDateRangeUnavailable(normalizedCheckIn, checkOut)) {
        // La plage chevauche une période indisponible, ne pas confirmer
        return;
      }
      
      onDateSelect(normalizedCheckIn, checkOut);
    }
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
    if (isDateUnavailable(date) || isDateBeforeCheckIn(date)) {
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
      {showHeader && (
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Sélectionner les dates</Text>
          <View style={styles.placeholder} />
        </View>
      )}

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
              const isBeforeCheckIn = isDateBeforeCheckIn(day);
              const reason = isUnavailable ? getUnavailableReason(day) : (isPast ? 'Passé' : (isBeforeCheckIn ? 'Avant arrivée' : null));

              return (
                <TouchableOpacity
                  key={index}
                  style={getDayStyle(day)}
                  onPress={() => handleDatePress(day)}
                  disabled={isUnavailable || isPast || isBeforeCheckIn}
                >
                  <Text style={[
                    styles.dayText,
                    (isUnavailable || isPast || isBeforeCheckIn) && styles.unavailableDayText,
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
          style={[
            styles.confirmButton, 
            ((mode === 'checkIn' && !tempCheckIn) || 
             (mode === 'checkOut' && !tempCheckOut) || 
             (mode === 'both' && !tempCheckIn)) && styles.confirmButtonDisabled
          ]}
          disabled={
            (mode === 'checkIn' && !tempCheckIn) || 
            (mode === 'checkOut' && !tempCheckOut) || 
            (mode === 'both' && !tempCheckIn)
          }
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
