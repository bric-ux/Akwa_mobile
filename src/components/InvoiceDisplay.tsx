import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCommissionRates, type ServiceType } from '../lib/commissions';

interface InvoiceDisplayProps {
  type: 'traveler' | 'host' | 'admin';
  serviceType: ServiceType;
  booking: {
    id: string;
    check_in_date?: string;
    check_out_date?: string;
    start_date?: string;
    end_date?: string;
    guests_count?: number;
    total_price: number;
    created_at?: string;
    discount_amount?: number;
    discount_applied?: boolean;
    payment_method?: string;
    status?: string;
    properties?: {
      service_fee?: number;
      taxes?: number;
      price_per_night?: number;
      cleaning_fee?: number;
      title?: string;
    };
  };
  pricePerUnit: number;
  cleaningFee?: number;
  serviceFee?: number;
  taxes?: number;
  paymentMethod?: string;
  travelerName?: string;
  travelerEmail?: string;
  travelerPhone?: string;
  hostName?: string;
  hostEmail?: string;
  hostPhone?: string;
  propertyOrVehicleTitle?: string;
}

const formatPriceFCFA = (amount: number): string => {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getPaymentMethodLabel = (method?: string): string => {
  if (!method) return 'Non spécifié';
  const methods: { [key: string]: string } = {
    mobile_money: 'Mobile Money',
    bank_transfer: 'Virement bancaire',
    cash: 'Espèces',
    card: 'Carte bancaire',
    orange_money: 'Orange Money',
    mtn_money: 'MTN Money',
    moov_money: 'Moov Money',
  };
  return methods[method] || method;
};

const getServiceTypeLabel = (serviceType: ServiceType): string => {
  return serviceType === 'property' ? 'Résidence meublée' : 'Location de véhicule';
};

export const InvoiceDisplay: React.FC<InvoiceDisplayProps> = ({
  type,
  serviceType,
  booking,
  pricePerUnit,
  cleaningFee = 0,
  serviceFee: providedServiceFee,
  taxes: providedTaxes,
  paymentMethod,
  travelerName,
  travelerEmail,
  travelerPhone,
  hostName,
  hostEmail,
  hostPhone,
  propertyOrVehicleTitle,
}) => {
  const effectivePaymentMethod = paymentMethod || booking.payment_method || 'Non spécifié';
  const checkIn = booking.check_in_date || booking.start_date || '';
  const checkOut = booking.check_out_date || booking.end_date || '';
  
  // Pour les véhicules, utiliser rental_days si disponible, sinon calculer avec +1 (comme lors de la création)
  // Pour les propriétés, utiliser le calcul standard
  let nights = 1;
  if (serviceType === 'vehicle' && (booking as any).rental_days) {
    nights = (booking as any).rental_days;
  } else if (checkIn && checkOut) {
    if (serviceType === 'vehicle') {
      // Pour les véhicules: différence + 1 (comme lors de la création de la réservation)
      nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else {
      // Pour les propriétés: calcul standard
      nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));
    }
  }
  
  const commissionRates = getCommissionRates(serviceType);
  const basePrice = pricePerUnit * nights;
  const discountAmount = booking.discount_amount || 0;
  
  // Prix après réduction (sans ajustement)
  const priceAfterDiscount = basePrice - discountAmount;
  
  // Calculer les frais de service sur le prix APRÈS réduction
  const effectiveServiceFee = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
  const actualDiscountAmount = discountAmount;
  const effectiveTaxes = providedTaxes !== undefined 
    ? providedTaxes 
    : (booking.properties?.taxes || 0);
  
  const hostCommission = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
  // Calculer le total payé : prix après réduction + frais de service + frais de ménage + taxes
  const calculatedTotal = priceAfterDiscount + effectiveServiceFee + cleaningFee + effectiveTaxes;
  // Pour les véhicules, toujours utiliser le calcul pour s'assurer que les frais de service sont inclus
  // (même si booking.total_price existe, il peut ne pas inclure les frais de service pour les anciennes réservations)
  // Pour les propriétés, utiliser booking.total_price s'il existe et correspond au calcul
  const totalPaidByTraveler = (serviceType === 'vehicle') 
    ? calculatedTotal // Toujours utiliser le calcul pour inclure les frais de service
    : (booking.total_price && Math.abs(booking.total_price - calculatedTotal) <= 100) 
      ? booking.total_price 
      : calculatedTotal;
  const hostNetAmount = booking.status === 'cancelled' ? 0 : (priceAfterDiscount - hostCommission);
  const akwaHomeTotalRevenue = effectiveServiceFee + hostCommission;

  const getTitle = () => {
    switch (type) {
      case 'traveler': return 'Facture voyageur';
      case 'host': return 'Justificatif hôte';
      case 'admin': return 'Facture interne Akwahome';
    }
  };

  return (
    <View style={styles.container}>
      {/* En-tête avec logo */}
      <View style={styles.header}>
        <Image
          source={{ uri: 'https://hqzgndjbxzgsyfoictgo.supabase.co/storage/v1/object/public/property-images/akwa-home-logo.png' }}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.headerRight}>
          <Text style={styles.headerType}>{getTitle()}</Text>
          <Text style={styles.invoiceNumber}>
            N° {booking.id.substring(0, 8).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Type de service */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Type de service</Text>
        <Text style={styles.sectionValue}>{getServiceTypeLabel(serviceType)}</Text>
      </View>

      {/* Titre propriété/véhicule */}
      {propertyOrVehicleTitle && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {serviceType === 'property' ? 'Propriété' : 'Véhicule'}
          </Text>
          <Text style={styles.sectionValue}>{propertyOrVehicleTitle}</Text>
        </View>
      )}

      {/* Dates */}
      <View style={styles.datesRow}>
        <View style={styles.dateItem}>
          <Text style={styles.sectionLabel}>
            {serviceType === 'property' ? 'Arrivée' : 'Début'}
          </Text>
          <Text style={styles.sectionValue}>{formatDate(checkIn)}</Text>
        </View>
        <View style={styles.dateItem}>
          <Text style={styles.sectionLabel}>
            {serviceType === 'property' ? 'Départ' : 'Fin'}
          </Text>
          <Text style={styles.sectionValue}>{formatDate(checkOut)}</Text>
        </View>
      </View>

      {/* Durée */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Durée</Text>
        <Text style={styles.sectionValue}>
          {nights} {serviceType === 'property' ? `nuit${nights > 1 ? 's' : ''}` : `jour${nights > 1 ? 's' : ''}`}
        </Text>
      </View>

      {/* Nombre de voyageurs (propriétés uniquement) */}
      {serviceType === 'property' && booking.guests_count && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Voyageurs</Text>
          <Text style={styles.sectionValue}>{booking.guests_count}</Text>
        </View>
      )}

      <View style={styles.separator} />

      {/* === FACTURE VOYAGEUR === */}
      {type === 'traveler' && (
        <View style={styles.financialSection}>
          <Text style={styles.financialTitle}>Détails du paiement</Text>
          
          {/* Prix initial */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Prix initial ({nights} {serviceType === 'property' ? 'nuits' : 'jours'})
            </Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(basePrice)}</Text>
          </View>

          {/* Réduction */}
          {actualDiscountAmount > 0 && (
            <>
              <View style={styles.financialRow}>
                <Text style={[styles.financialLabel, styles.discountText]}>Réduction appliquée</Text>
                <Text style={[styles.financialValue, styles.discountText]}>
                  -{formatPriceFCFA(actualDiscountAmount)}
                </Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Prix après réduction</Text>
                <Text style={styles.financialValue}>{formatPriceFCFA(priceAfterDiscount)}</Text>
              </View>
            </>
          )}

          {/* Frais de ménage */}
          {cleaningFee > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Frais de ménage</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(cleaningFee)}</Text>
            </View>
          )}

          {/* Frais de service */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Frais de service Akwahome
            </Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(effectiveServiceFee)}</Text>
          </View>

          {/* Taxes */}
          {effectiveTaxes > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Taxes locales</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(effectiveTaxes)}</Text>
            </View>
          )}

          <View style={styles.separator} />

          {/* Total */}
          <View style={styles.financialRow}>
            <Text style={styles.totalLabel}>Total payé</Text>
            <Text style={styles.totalValue}>{formatPriceFCFA(totalPaidByTraveler)}</Text>
          </View>

          {/* Mode de paiement */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Mode de paiement</Text>
            <Text style={styles.financialValue}>{getPaymentMethodLabel(effectivePaymentMethod)}</Text>
          </View>

          {/* Contact hôte */}
          {hostName && hostPhone && (booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'completed') && (
            <View style={styles.contactSection}>
              <View style={styles.contactHeader}>
                <Ionicons name="call-outline" size={16} color="#333" />
                <Text style={styles.contactTitle}>Contact de l'hôte</Text>
              </View>
              <Text style={styles.contactName}>{hostName}</Text>
              <Text style={styles.contactPhone}>{hostPhone}</Text>
            </View>
          )}
        </View>
      )}

      {/* === JUSTIFICATIF HÔTE === */}
      {type === 'host' && (
        <View style={styles.financialSection}>
          <Text style={styles.financialTitle}>Votre versement</Text>
          
          {/* Montant de la réservation */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Montant de la réservation</Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(priceAfterDiscount)}</Text>
          </View>

          {/* Info réduction */}
          {discountAmount > 0 && (
            <Text style={styles.discountNote}>
              (Réduction de {formatPriceFCFA(discountAmount)} déjà déduite)
            </Text>
          )}

          {/* Commission Akwahome */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Commission Akwahome ({commissionRates.hostFeePercent}%)
            </Text>
            <Text style={[styles.financialValue, styles.commissionText]}>
              -{formatPriceFCFA(hostCommission)}
            </Text>
          </View>

          <View style={styles.separator} />

          {/* Gain net */}
          <View style={styles.financialRow}>
            <Text style={styles.totalLabel}>Vous recevez</Text>
            <Text style={[styles.totalValue, styles.netAmountText]}>
              {formatPriceFCFA(hostNetAmount)}
            </Text>
          </View>

          {/* Mode de paiement */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Mode de paiement</Text>
            <Text style={styles.financialValue}>{getPaymentMethodLabel(effectivePaymentMethod)}</Text>
          </View>

          {/* Contact voyageur */}
          {travelerName && travelerPhone && (
            <View style={styles.contactSection}>
              <View style={styles.contactHeader}>
                <Ionicons name="call-outline" size={16} color="#333" />
                <Text style={styles.contactTitle}>Contact du voyageur</Text>
              </View>
              <Text style={styles.contactName}>{travelerName}</Text>
              <Text style={styles.contactPhone}>{travelerPhone}</Text>
            </View>
          )}
        </View>
      )}

      {/* === FACTURE INTERNE ADMIN === */}
      {type === 'admin' && (
        <View style={styles.financialSection}>
          {/* Infos voyageur */}
          {travelerName && (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>Voyageur</Text>
              <Text style={styles.infoBoxText}>{travelerName}</Text>
              {travelerEmail && <Text style={styles.infoBoxSubtext}>{travelerEmail}</Text>}
              {travelerPhone && <Text style={styles.infoBoxSubtext}>{travelerPhone}</Text>}
            </View>
          )}

          {/* Infos hôte */}
          {hostName && (
            <View style={[styles.infoBox, styles.hostInfoBox]}>
              <Text style={styles.infoBoxTitle}>Hôte/Propriétaire</Text>
              <Text style={styles.infoBoxText}>{hostName}</Text>
              {hostEmail && <Text style={styles.infoBoxSubtext}>{hostEmail}</Text>}
              {hostPhone && <Text style={styles.infoBoxSubtext}>{hostPhone}</Text>}
            </View>
          )}

          <View style={styles.separator} />

          <Text style={styles.financialTitle}>Détails financiers complets</Text>
          
          {/* Prix initial */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Prix initial</Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(basePrice)}</Text>
          </View>

          {/* Réduction */}
          {discountAmount > 0 && (
            <View style={styles.financialRow}>
              <Text style={[styles.financialLabel, styles.discountText]}>Réduction appliquée</Text>
              <Text style={[styles.financialValue, styles.discountText]}>
                -{formatPriceFCFA(discountAmount)}
              </Text>
            </View>
          )}

          {/* Prix après réduction */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Prix après réduction</Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(priceAfterDiscount)}</Text>
          </View>

          {/* Frais de ménage */}
          {cleaningFee > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Frais de ménage</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(cleaningFee)}</Text>
            </View>
          )}

          <View style={styles.separator} />

          {/* Commissions détaillées */}
          <View style={styles.commissionBox}>
            <Text style={styles.commissionBoxTitle}>Commissions Akwahome</Text>
            
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Frais de service voyageur</Text>
              <Text style={[styles.financialValue, styles.commissionValue]}>
                +{formatPriceFCFA(effectiveServiceFee)}
              </Text>
            </View>

            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>
                Commission hôte ({commissionRates.hostFeePercent}%)
              </Text>
              <Text style={[styles.financialValue, styles.commissionValue]}>
                +{formatPriceFCFA(hostCommission)}
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.financialRow}>
              <Text style={styles.totalLabel}>Revenu total Akwahome</Text>
              <Text style={[styles.totalValue, styles.commissionTotal]}>
                {formatPriceFCFA(akwaHomeTotalRevenue)}
              </Text>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Résumé */}
          <View style={styles.summaryRow}>
            <Text style={styles.financialLabel}>Total payé par le voyageur</Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(totalPaidByTraveler)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.financialLabel}>Versement net à l'hôte</Text>
            <Text style={[styles.financialValue, styles.netAmountText]}>
              {formatPriceFCFA(hostNetAmount)}
            </Text>
          </View>

          {/* Mode de paiement */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Mode de paiement</Text>
            <Text style={styles.financialValue}>{getPaymentMethodLabel(effectivePaymentMethod)}</Text>
          </View>
        </View>
      )}

      {/* Date de réservation */}
      {booking.created_at && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Date de réservation: {formatDateTime(booking.created_at)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#F97316',
  },
  logo: {
    height: 48,
    width: 120,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerType: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
  },
  section: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateItem: {
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  financialSection: {
    marginTop: 8,
  },
  financialTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  financialLabel: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  financialValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  discountText: {
    color: '#059669',
  },
  discountNote: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  commissionText: {
    color: '#dc2626',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },
  netAmountText: {
    color: '#059669',
  },
  contactSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 13,
    color: '#2563eb',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  hostInfoBox: {
    backgroundColor: '#f0fdf4',
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  infoBoxText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 2,
  },
  infoBoxSubtext: {
    fontSize: 11,
    color: '#6b7280',
  },
  commissionBox: {
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  commissionBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c2410c',
    marginBottom: 8,
  },
  commissionValue: {
    color: '#ea580c',
  },
  commissionTotal: {
    color: '#c2410c',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  footer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerText: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default InvoiceDisplay;
