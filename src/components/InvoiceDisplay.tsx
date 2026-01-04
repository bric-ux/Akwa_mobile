import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getCommissionRates, ServiceType } from '../lib/commissions';
import { formatPrice } from '../utils/priceCalculator';

interface InvoiceDisplayProps {
  type: 'traveler' | 'host';
  serviceType: ServiceType;
  booking: {
    id: string;
    check_in_date?: string;
    check_out_date?: string;
    start_date?: string;
    end_date?: string;
    guests_count?: number;
    total_price: number;
    discount_amount?: number;
    discount_applied?: boolean;
    payment_method?: string;
    status?: string;
  };
  pricePerUnit: number;
  cleaningFee?: number;
  serviceFee?: number;
  taxes?: number;
  paymentMethod?: string;
  propertyOrVehicleTitle?: string;
}

const InvoiceDisplay: React.FC<InvoiceDisplayProps> = ({
  type,
  serviceType,
  booking,
  pricePerUnit,
  cleaningFee = 0,
  serviceFee: providedServiceFee,
  taxes: providedTaxes,
  paymentMethod,
  propertyOrVehicleTitle,
}) => {
  const checkIn = booking.check_in_date || booking.start_date || '';
  const checkOut = booking.check_out_date || booking.end_date || '';
  
  const nights = checkIn && checkOut 
    ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
    : 1;
  
  const commissionRates = getCommissionRates(serviceType);
  const basePrice = pricePerUnit * nights;
  const discountAmount = booking.discount_amount || 0;
  
  // Calculer le prix après réduction
  let priceAfterDiscount = basePrice - discountAmount;
  
  // Si le total_price existe, recalculer pour garantir la cohérence
  if (booking.total_price) {
    const calculatedServiceFee = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
    const calculatedTotal = priceAfterDiscount + calculatedServiceFee + cleaningFee + (providedTaxes || 0);
    
    if (Math.abs(calculatedTotal - booking.total_price) > 100) {
      const taxes = providedTaxes || 0;
      priceAfterDiscount = Math.round((booking.total_price - cleaningFee - taxes) / (1 + commissionRates.travelerFeePercent / 100));
    }
  }
  
  // Calculer les frais de service
  const effectiveServiceFee = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
  
  // Recalculer le discountAmount pour l'affichage
  const actualDiscountAmount = basePrice - priceAfterDiscount;
  
  // Utiliser les taxes fournies
  const effectiveTaxes = providedTaxes !== undefined ? providedTaxes : 0;
  
  // Commission hôte
  const hostCommission = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
  
  // Totaux
  const totalPaidByTraveler = booking.total_price || (priceAfterDiscount + effectiveServiceFee + cleaningFee + effectiveTaxes);
  const hostNetAmount = booking.status === 'cancelled' ? 0 : (priceAfterDiscount - hostCommission);
  
  // Utiliser le bon mode de paiement
  const effectivePaymentMethod = paymentMethod || booking.payment_method || 'Non spécifié';
  
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      card: 'Carte bancaire',
      wave: 'Wave',
      orange_money: 'Orange Money',
      mtn_money: 'MTN Money',
      moov_money: 'Moov Money',
      cash: 'Espèces',
    };
    return labels[method] || method;
  };

  const getServiceTypeLabel = (type: ServiceType) => {
    return type === 'property' ? 'Résidence meublée' : 'Location de véhicule';
  };

  return (
    <View style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {type === 'traveler' ? 'Facture voyageur' : 'Justificatif hôte'}
        </Text>
        <Text style={styles.bookingNumber}>
          N° {booking.id.substring(0, 8).toUpperCase()}
        </Text>
      </View>

      {/* Type de service */}
      <View style={styles.serviceTypeContainer}>
        <Text style={styles.serviceTypeLabel}>Type de service</Text>
        <Text style={styles.serviceTypeValue}>{getServiceTypeLabel(serviceType)}</Text>
      </View>

      {/* Titre propriété/véhicule */}
      {propertyOrVehicleTitle && (
        <View style={styles.titleContainer}>
          <Text style={styles.titleLabel}>
            {serviceType === 'property' ? 'Propriété' : 'Véhicule'}
          </Text>
          <Text style={styles.titleValue}>{propertyOrVehicleTitle}</Text>
        </View>
      )}

      {/* Dates */}
      <View style={styles.datesContainer}>
        <View style={styles.dateItem}>
          <Text style={styles.dateLabel}>
            {serviceType === 'property' ? 'Arrivée' : 'Début'}
          </Text>
          <Text style={styles.dateValue}>{formatDate(checkIn)}</Text>
        </View>
        <View style={styles.dateItem}>
          <Text style={styles.dateLabel}>
            {serviceType === 'property' ? 'Départ' : 'Fin'}
          </Text>
          <Text style={styles.dateValue}>{formatDate(checkOut)}</Text>
        </View>
      </View>

      {/* Durée */}
      <View style={styles.durationContainer}>
        <Text style={styles.durationLabel}>Durée</Text>
        <Text style={styles.durationValue}>
          {nights} {serviceType === 'property' ? `nuit${nights > 1 ? 's' : ''}` : `jour${nights > 1 ? 's' : ''}`}
        </Text>
      </View>

      {/* Nombre de voyageurs (propriétés uniquement) */}
      {serviceType === 'property' && booking.guests_count && (
        <View style={styles.guestsContainer}>
          <Text style={styles.guestsLabel}>Voyageurs</Text>
          <Text style={styles.guestsValue}>{booking.guests_count}</Text>
        </View>
      )}

      <View style={styles.separator} />

      {/* === FACTURE VOYAGEUR === */}
      {type === 'traveler' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détails du paiement</Text>
          
          {/* Prix initial */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>
              Prix initial ({nights} {serviceType === 'property' ? 'nuits' : 'jours'})
            </Text>
            <Text style={styles.rowValue}>{formatPrice(basePrice)}</Text>
          </View>

          {/* Réduction */}
          {actualDiscountAmount > 0 && (
            <>
              <View style={styles.row}>
                <Text style={[styles.rowLabel, styles.discountText]}>Réduction appliquée</Text>
                <Text style={[styles.rowValue, styles.discountText]}>
                  -{formatPrice(actualDiscountAmount)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Prix après réduction</Text>
                <Text style={styles.rowValue}>{formatPrice(priceAfterDiscount)}</Text>
              </View>
            </>
          )}

          {/* Frais de ménage */}
          {cleaningFee > 0 && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Frais de ménage</Text>
              <Text style={styles.rowValue}>{formatPrice(cleaningFee)}</Text>
            </View>
          )}

          {/* Frais de service */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>
              Frais de service Akwahome{serviceType === 'property' ? ` (${commissionRates.travelerFeePercent}%)` : ''}
            </Text>
            <Text style={styles.rowValue}>{formatPrice(effectiveServiceFee)}</Text>
          </View>

          {/* Taxes */}
          {effectiveTaxes > 0 && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Taxes locales</Text>
              <Text style={styles.rowValue}>{formatPrice(effectiveTaxes)}</Text>
            </View>
          )}

          <View style={styles.separator} />

          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total payé</Text>
            <Text style={styles.totalValue}>{formatPrice(totalPaidByTraveler)}</Text>
          </View>

          {/* Mode de paiement */}
          <View style={styles.paymentMethodContainer}>
            <Text style={styles.paymentMethodLabel}>Mode de paiement</Text>
            <Text style={styles.paymentMethodValue}>{getPaymentMethodLabel(effectivePaymentMethod)}</Text>
          </View>
        </View>
      )}

      {/* === JUSTIFICATIF HÔTE === */}
      {type === 'host' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Votre versement</Text>
          
          {booking.status === 'cancelled' ? (
            <>
              <View style={styles.cancelledNotice}>
                <Text style={styles.cancelledNoticeText}>
                  Cette réservation a été annulée. Vous ne recevez aucun versement.
                </Text>
              </View>
              <View style={styles.separator} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Vous recevez</Text>
                <Text style={[styles.totalValue, styles.netAmountText]}>
                  {formatPrice(0)}
                </Text>
              </View>
            </>
          ) : (
            <>
              {/* Montant de la réservation */}
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Montant de la réservation</Text>
                <Text style={styles.rowValue}>{formatPrice(priceAfterDiscount)}</Text>
              </View>

              {/* Info réduction */}
              {discountAmount > 0 && (
                <Text style={styles.discountNote}>
                  (Réduction de {formatPrice(discountAmount)} déjà déduite)
                </Text>
              )}

              {/* Commission Akwahome */}
              <View style={styles.row}>
                <Text style={styles.rowLabel}>
                  Commission Akwahome ({commissionRates.hostFeePercent}%)
                </Text>
                <Text style={[styles.rowValue, styles.commissionText]}>
                  -{formatPrice(hostCommission)}
                </Text>
              </View>

              <View style={styles.separator} />

              {/* Gain net */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Vous recevez</Text>
                <Text style={[styles.totalValue, styles.netAmountText]}>
                  {formatPrice(hostNetAmount)}
                </Text>
              </View>
            </>
          )}

          {/* Mode de paiement */}
          <View style={styles.paymentMethodContainer}>
            <Text style={styles.paymentMethodLabel}>Mode de paiement</Text>
            <Text style={styles.paymentMethodValue}>{getPaymentMethodLabel(effectivePaymentMethod)}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#F97316',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  bookingNumber: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '600',
    color: '#666',
  },
  serviceTypeContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  serviceTypeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  serviceTypeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  titleContainer: {
    marginBottom: 16,
  },
  titleLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  titleValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  datesContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  durationContainer: {
    marginBottom: 16,
  },
  durationLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  durationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  guestsContainer: {
    marginBottom: 16,
  },
  guestsLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  guestsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  separator: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 16,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  rowValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  discountText: {
    color: '#059669',
  },
  discountNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  commissionText: {
    color: '#dc2626',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#333',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F97316',
  },
  netAmountText: {
    color: '#059669',
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  paymentMethodLabel: {
    fontSize: 14,
    color: '#666',
  },
  paymentMethodValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  cancelledNotice: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  cancelledNoticeText: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default InvoiceDisplay;

