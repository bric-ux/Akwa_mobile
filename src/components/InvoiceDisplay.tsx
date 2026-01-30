import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCommissionRates, type ServiceType } from '../lib/commissions';
import { calculateTotalPrice, calculateHostCommission, type DiscountConfig } from '../hooks/usePricing';
import akwaHomeLogo from '../../assets/images/akwahome_logo.png';

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
      discount_enabled?: boolean;
      discount_min_nights?: number | null;
      discount_percentage?: number | null;
      long_stay_discount_enabled?: boolean;
      long_stay_discount_min_nights?: number | null;
      long_stay_discount_percentage?: number | null;
      free_cleaning_min_days?: number | null;
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
  const [showVATInvoice, setShowVATInvoice] = useState(false);
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
  
  // Recalculer la réduction pour être sûr d'avoir la bonne valeur (comme dans PropertyBookingDetailsScreen)
  let discountAmount = 0;
  if (serviceType === 'property' && booking.properties) {
    const discountConfig: DiscountConfig = {
      enabled: booking.properties.discount_enabled || false,
      minNights: booking.properties.discount_min_nights || null,
      percentage: booking.properties.discount_percentage || null
    };
    const longStayDiscountConfig: DiscountConfig | undefined = booking.properties.long_stay_discount_enabled ? {
      enabled: booking.properties.long_stay_discount_enabled || false,
      minNights: booking.properties.long_stay_discount_min_nights || null,
      percentage: booking.properties.long_stay_discount_percentage || null
    } : undefined;
    
    try {
      const pricing = calculateTotalPrice(pricePerUnit, nights, discountConfig, longStayDiscountConfig);
      discountAmount = pricing.discountAmount || 0;
    } catch (error) {
      console.error('Erreur lors du calcul de la réduction dans InvoiceDisplay:', error);
      // En cas d'erreur, utiliser la valeur stockée
      discountAmount = booking.discount_amount || 0;
    }
  } else {
    // Pour les véhicules ou si pas de propriété, utiliser la valeur stockée
    discountAmount = booking.discount_amount || 0;
  }
  
  // Prix après réduction (sans ajustement)
  const priceAfterDiscount = basePrice - discountAmount;
  const actualDiscountAmount = discountAmount;
  const effectiveTaxes = providedTaxes !== undefined 
    ? providedTaxes 
    : (booking.properties?.taxes || 0);
  
  // Calculer les frais de service avec TVA
  const serviceFeeHT = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
  const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
  const effectiveServiceFee = serviceFeeHT + serviceFeeVAT;
  
  // Calculer la commission hôte avec TVA
  const hostCommissionData = calculateHostCommission(priceAfterDiscount, serviceType);
  const hostCommission = hostCommissionData.hostCommission;
  const hostCommissionHT = hostCommissionData.hostCommissionHT;
  const hostCommissionVAT = hostCommissionData.hostCommissionVAT;
  
  // Calculer les frais de ménage en tenant compte de free_cleaning_min_days
  // Utiliser le cleaningFee passé en paramètre si fourni, sinon utiliser celui de la propriété
  let effectiveCleaningFee = cleaningFee !== undefined ? cleaningFee : (booking.properties?.cleaning_fee || 0);
  
  // Appliquer la logique free_cleaning_min_days si applicable
  if (serviceType === 'property' && booking.properties?.free_cleaning_min_days && nights >= booking.properties.free_cleaning_min_days) {
    effectiveCleaningFee = 0;
  }
  
  // Calculer le total payé : prix après réduction + frais de service + frais de ménage + taxes
  const calculatedTotal = priceAfterDiscount + effectiveServiceFee + effectiveCleaningFee + effectiveTaxes;
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
          source={akwaHomeLogo}
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
          {effectiveCleaningFee > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Frais de ménage</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(effectiveCleaningFee)}</Text>
            </View>
          )}

          {/* Frais de service avec détails TVA */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Frais de service Akwahome
            </Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(effectiveServiceFee)}</Text>
          </View>
          
          {/* Détails TVA pour frais de service */}
          <View style={styles.vatDetailsContainer}>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>Frais de base (HT)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(serviceFeeHT)}</Text>
            </View>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>TVA (20%)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(serviceFeeVAT)}</Text>
            </View>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>Total (TTC)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(effectiveServiceFee)}</Text>
            </View>
          </View>
          
          {/* Bouton voir facture avec TVA */}
          <TouchableOpacity 
            style={styles.vatInvoiceButton}
            onPress={() => setShowVATInvoice(true)}
          >
            <Ionicons name="document-text-outline" size={16} color="#007bff" />
            <Text style={styles.vatInvoiceButtonText}>Voir facture avec TVA</Text>
          </TouchableOpacity>

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
          {/* Détails du paiement du voyageur/locataire */}
          <Text style={styles.financialTitle}>Détails du paiement {serviceType === 'property' ? 'du voyageur' : 'du locataire'}</Text>
          
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
          {effectiveCleaningFee > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Frais de ménage</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(effectiveCleaningFee)}</Text>
            </View>
          )}

          {/* Frais de service avec détails TVA */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Frais de service Akwahome
            </Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(effectiveServiceFee)}</Text>
          </View>
          
          {/* Détails TVA pour frais de service */}
          <View style={styles.vatDetailsContainer}>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>Frais de base (HT)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(serviceFeeHT)}</Text>
            </View>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>TVA (20%)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(serviceFeeVAT)}</Text>
            </View>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>Total (TTC)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(effectiveServiceFee)}</Text>
            </View>
          </View>

          {/* Taxes */}
          {effectiveTaxes > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Taxes locales</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(effectiveTaxes)}</Text>
            </View>
          )}

          <View style={styles.separator} />

          {/* Total payé par le voyageur */}
          <View style={styles.financialRow}>
            <Text style={styles.totalLabel}>Total payé {serviceType === 'property' ? 'par le voyageur' : 'par le locataire'}</Text>
            <Text style={styles.totalValue}>{formatPriceFCFA(totalPaidByTraveler)}</Text>
          </View>

          <View style={styles.separator} />

          {/* Versement de l'hôte/propriétaire */}
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

          {/* Commission Akwahome avec détails TVA */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Commission Akwahome ({commissionRates.hostFeePercent}%)
            </Text>
            <Text style={[styles.financialValue, styles.commissionText]}>
              -{formatPriceFCFA(hostCommission)}
            </Text>
          </View>
          
          {/* Détails TVA pour commission hôte */}
          <View style={styles.vatDetailsContainer}>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>Commission de base (HT)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(hostCommissionHT)}</Text>
            </View>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>TVA (20%)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(hostCommissionVAT)}</Text>
            </View>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>Total (TTC)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(hostCommission)}</Text>
            </View>
          </View>
          
          {/* Bouton voir facture avec TVA */}
          <TouchableOpacity 
            style={styles.vatInvoiceButton}
            onPress={() => setShowVATInvoice(true)}
          >
            <Ionicons name="document-text-outline" size={16} color="#007bff" />
            <Text style={styles.vatInvoiceButtonText}>Voir facture avec TVA</Text>
          </TouchableOpacity>

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
                <Text style={styles.contactTitle}>Contact {serviceType === 'property' ? 'du voyageur' : 'du locataire'}</Text>
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
          {effectiveCleaningFee > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Frais de ménage</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(effectiveCleaningFee)}</Text>
            </View>
          )}

          <View style={styles.separator} />

          {/* Commissions détaillées avec TVA */}
          <View style={styles.commissionBox}>
            <Text style={styles.commissionBoxTitle}>Commissions Akwahome</Text>
            
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Frais de service voyageur (TTC)</Text>
              <Text style={[styles.financialValue, styles.commissionValue]}>
                +{formatPriceFCFA(effectiveServiceFee)}
              </Text>
            </View>
            <View style={styles.vatDetailsContainer}>
              <View style={styles.vatDetailRow}>
                <Text style={styles.vatDetailLabel}>Frais de base (HT)</Text>
                <Text style={styles.vatDetailValue}>{formatPriceFCFA(serviceFeeHT)}</Text>
              </View>
              <View style={styles.vatDetailRow}>
                <Text style={styles.vatDetailLabel}>TVA (20%)</Text>
                <Text style={styles.vatDetailValue}>{formatPriceFCFA(serviceFeeVAT)}</Text>
              </View>
            </View>

            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>
                Commission hôte ({commissionRates.hostFeePercent}%) (TTC)
              </Text>
              <Text style={[styles.financialValue, styles.commissionValue]}>
                +{formatPriceFCFA(hostCommission)}
              </Text>
            </View>
            <View style={styles.vatDetailsContainer}>
              <View style={styles.vatDetailRow}>
                <Text style={styles.vatDetailLabel}>Commission de base (HT)</Text>
                <Text style={styles.vatDetailValue}>{formatPriceFCFA(hostCommissionHT)}</Text>
              </View>
              <View style={styles.vatDetailRow}>
                <Text style={styles.vatDetailLabel}>TVA (20%)</Text>
                <Text style={styles.vatDetailValue}>{formatPriceFCFA(hostCommissionVAT)}</Text>
              </View>
            </View>

            <View style={styles.separator} />

            <View style={styles.financialRow}>
              <Text style={styles.totalLabel}>Revenu total Akwahome (HT)</Text>
              <Text style={[styles.totalValue, styles.commissionTotal]}>
                {formatPriceFCFA(serviceFeeHT + hostCommissionHT)}
              </Text>
            </View>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>TVA totale collectée</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(serviceFeeVAT + hostCommissionVAT)}</Text>
            </View>
            
            {/* Bouton voir facture avec TVA */}
            <TouchableOpacity 
              style={styles.vatInvoiceButton}
              onPress={() => setShowVATInvoice(true)}
            >
              <Ionicons name="document-text-outline" size={16} color="#007bff" />
              <Text style={styles.vatInvoiceButtonText}>Voir facture avec TVA</Text>
            </TouchableOpacity>
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

      {/* Pied de page avec logo */}
      <View style={styles.footerSection}>
        <Image
          source={akwaHomeLogo}
          style={styles.footerLogo}
          resizeMode="contain"
        />
        <Text style={styles.footerBrandText}>
          AkwaHome - Votre plateforme de réservation en Côte d'Ivoire
        </Text>
      </View>

      {/* Modal Facture avec TVA */}
      <Modal
        visible={showVATInvoice}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVATInvoice(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Facture avec TVA</Text>
              <TouchableOpacity onPress={() => setShowVATInvoice(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              {/* Informations émetteur */}
              <View style={styles.vatInvoiceSection}>
                <Text style={styles.vatInvoiceSectionTitle}>Facture émise par</Text>
                <Text style={styles.vatInvoiceCompanyName}>Akwahome</Text>
                <Text style={styles.vatInvoiceAddress}>CI-ABJ-03-2025-B12-06694</Text>
              </View>

              {/* Informations destinataire */}
              {type === 'traveler' && travelerName && (
                <View style={styles.vatInvoiceSection}>
                  <Text style={styles.vatInvoiceSectionTitle}>Facture envoyée à</Text>
                  <Text style={styles.vatInvoiceRecipientName}>{travelerName}</Text>
                  {travelerEmail && <Text style={styles.vatInvoiceRecipientDetail}>{travelerEmail}</Text>}
                  {travelerPhone && <Text style={styles.vatInvoiceRecipientDetail}>{travelerPhone}</Text>}
                </View>
              )}

              {type === 'host' && hostName && (
                <View style={styles.vatInvoiceSection}>
                  <Text style={styles.vatInvoiceSectionTitle}>Facture envoyée à</Text>
                  <Text style={styles.vatInvoiceRecipientName}>{hostName}</Text>
                  {hostEmail && <Text style={styles.vatInvoiceRecipientDetail}>{hostEmail}</Text>}
                  {hostPhone && <Text style={styles.vatInvoiceRecipientDetail}>{hostPhone}</Text>}
                </View>
              )}

              {/* Numéro et date de facture */}
              <View style={styles.vatInvoiceSection}>
                <View style={styles.vatInvoiceRow}>
                  <Text style={styles.vatInvoiceLabel}>Date d'émission de la facture</Text>
                  <Text style={styles.vatInvoiceValue}>{formatDate(booking.created_at || new Date().toISOString())}</Text>
                </View>
                <View style={styles.vatInvoiceRow}>
                  <Text style={styles.vatInvoiceLabel}>Numéro de facture</Text>
                  <Text style={styles.vatInvoiceValue}>AKWA-{booking.id.substring(0, 8).toUpperCase()}</Text>
                </View>
              </View>

              {/* Description */}
              <View style={styles.vatInvoiceSection}>
                <Text style={styles.vatInvoiceSectionTitle}>Description</Text>
                <Text style={styles.vatInvoiceDescription}>
                  Frais d'utilisation de la plateforme en ligne pour la réservation {booking.id.substring(0, 8).toUpperCase()} du {formatDate(booking.created_at || new Date().toISOString())}
                </Text>
              </View>

              {/* Détails avec TVA */}
              <View style={styles.vatInvoiceSection}>
                <Text style={styles.vatInvoiceSectionTitle}>Détails</Text>
                
                <View style={styles.vatInvoiceDetailsTable}>
                  <View style={styles.vatInvoiceTableRow}>
                    <Text style={styles.vatInvoiceTableLabel}>PAYS DE FACTURATION DE LA TVA</Text>
                    <Text style={styles.vatInvoiceTableValue}>CI</Text>
                  </View>
                  <View style={styles.vatInvoiceTableRow}>
                    <Text style={styles.vatInvoiceTableLabel}>TAUX DE TVA</Text>
                    <Text style={styles.vatInvoiceTableValue}>20,0%</Text>
                  </View>
                  
                  {type === 'traveler' && (
                    <>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>FRAIS DE BASE</Text>
                        <Text style={styles.vatInvoiceTableValue}>Frais de service</Text>
                      </View>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>MONTANT</Text>
                        <Text style={styles.vatInvoiceTableValue}>{formatPriceFCFA(serviceFeeHT)}</Text>
                      </View>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>MONTANT DE LA TVA</Text>
                        <Text style={styles.vatInvoiceTableValue}>{formatPriceFCFA(serviceFeeVAT)}</Text>
                      </View>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>TOTAL DES FRAIS, TVA INCLUSE</Text>
                        <Text style={styles.vatInvoiceTableValue}>{formatPriceFCFA(effectiveServiceFee)}</Text>
                      </View>
                    </>
                  )}

                  {type === 'host' && (
                    <>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>FRAIS DE BASE</Text>
                        <Text style={styles.vatInvoiceTableValue}>Commission Akwahome</Text>
                      </View>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>MONTANT</Text>
                        <Text style={styles.vatInvoiceTableValue}>{formatPriceFCFA(hostCommissionHT)}</Text>
                      </View>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>MONTANT DE LA TVA</Text>
                        <Text style={styles.vatInvoiceTableValue}>{formatPriceFCFA(hostCommissionVAT)}</Text>
                      </View>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>TOTAL DES FRAIS, TVA INCLUSE</Text>
                        <Text style={styles.vatInvoiceTableValue}>{formatPriceFCFA(hostCommission)}</Text>
                      </View>
                    </>
                  )}
                </View>
              </View>

              {/* Sous-total */}
              <View style={styles.vatInvoiceSeparator} />
              <View style={styles.vatInvoiceSection}>
                <View style={styles.vatInvoiceSubtotalRow}>
                  <Text style={styles.vatInvoiceSubtotalLabel}>Sous-total</Text>
                  <Text style={styles.vatInvoiceSubtotalValue}>
                    {type === 'traveler' ? formatPriceFCFA(effectiveServiceFee) : formatPriceFCFA(hostCommission)}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  footerSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#F97316',
    alignItems: 'center',
  },
  footerLogo: {
    height: 32,
    width: 100,
    marginBottom: 8,
    opacity: 0.5,
  },
  footerBrandText: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  // Styles pour détails TVA
  vatDetailsContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  vatDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  vatDetailLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  vatDetailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  vatInvoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9ff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#007bff',
  },
  vatInvoiceButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007bff',
    marginLeft: 6,
  },
  // Styles pour modal facture avec TVA
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '95%',
    maxHeight: '95%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  vatInvoiceSection: {
    marginBottom: 24,
  },
  vatInvoiceSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  vatInvoiceCompanyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  vatInvoiceAddress: {
    fontSize: 13,
    color: '#6b7280',
  },
  vatInvoiceRecipientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  vatInvoiceRecipientDetail: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  vatInvoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  vatInvoiceLabel: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
  },
  vatInvoiceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  vatInvoiceDescription: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },
  vatInvoiceDetailsTable: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  vatInvoiceTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  vatInvoiceTableLabel: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
  },
  vatInvoiceTableValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  vatInvoiceSeparator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  vatInvoiceSubtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vatInvoiceSubtotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  vatInvoiceSubtotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },
});

export default InvoiceDisplay;
