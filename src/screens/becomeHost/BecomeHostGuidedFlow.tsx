import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CitySearchInputModal from '../../components/CitySearchInputModal';
import IdentityVerificationAlert from '../../components/IdentityVerificationAlert';
import { PROPERTY_TYPES } from '../../constants/hostListingForm';
import type { Amenity } from '../../types';

const teddyAsset = require('../../../assets/teddy.png');

export const GUIDED_STEPS_LABELS = [
  'Type de logement',
  'Localisation & capacité',
  'Titre & description',
  'Prix & réductions',
  'Informations hôte',
  'Équipements',
  'Frais & règlement',
  'Photos, identité & validation',
] as const;

const GUIDED_EMOJIS = ['🥥', '🏡', '🌴', '🏙️', '🧭', '🛎️', '🔐', '✅'];

const PROPERTY_ICONS: Record<string, string> = {
  apartment: '🏢',
  house: '🏠',
  villa: '🏡',
  studio: '🛏️',
  guesthouse: '🛎️',
  eco_lodge: '🌿',
};

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16];
const BEDROOM_OPTIONS = [1, 2, 3, 4, 5, 6];
const BATHROOM_OPTIONS = [1, 2, 3, 4, 5];

export type BecomeHostGuidedFlowProps = {
  guidedStep: number;
  setGuidedStep: React.Dispatch<React.SetStateAction<number>>;
  isEditMode: boolean;
  fieldsToRevise: Record<string, boolean>;
  revisionMessage: string;
  formData: Record<string, any>;
  handleInputChange: (field: string, value: string | boolean) => void;
  handleLocationSelect: (result: any) => void;
  shouldShowField: (field: string) => boolean;
  /** Teddy IA */
  aiTitleSuggestions: string[];
  aiDraftDescription: string;
  aiGenerating: boolean;
  generateAiTitleAndDescription: () => void;
  /** Parrainage */
  isReferred: boolean;
  setIsReferred: (v: boolean) => void;
  enteredReferralCode: string;
  referralCodeError: string;
  referrerName: string;
  onReferralCodeInputChange: (code: string) => void;
  /** Équipements */
  availableAmenities: Amenity[];
  selectedAmenities: string[];
  toggleAmenity: (name: string) => void;
  customAmenities: string;
  setCustomAmenities: (v: string) => void;
  /** Identité */
  hasUploadedIdentity: boolean;
  identityUploadedInSession: boolean;
  onIdentityComplete: () => void;
  verificationStatus: string | undefined;
  /** Blocs fournis par l’écran parent (réutilise la logique existante) */
  photosSection: React.ReactNode;
  paymentSection: React.ReactNode;
  /** Politique d’annulation : ouvre le modal parent */
  onOpenCancellationModal: () => void;
  cancellationLabel: string;
  /** Soumission */
  onSubmit: () => void;
  loading: boolean;
  isSubmitting: boolean;
  isPhoneAccount?: boolean;
};

function canGoNextGuided(
  step: number,
  fd: Record<string, unknown>,
  extras: { hostFullName: string; hostEmail: string; hostPhone: string; isPhoneAccount?: boolean },
): boolean {
  switch (step) {
    case 1:
      return Boolean(fd.propertyType);
    case 2:
      return Boolean(fd.location && fd.guests && fd.bedrooms && fd.bathrooms);
    case 3:
      return Boolean(String(fd.title || '').trim() && String(fd.description || '').trim());
    case 4:
      return Boolean(fd.price && String(fd.price).trim());
    case 5:
      return Boolean(
        extras.hostFullName &&
          extras.hostPhone &&
          (extras.isPhoneAccount || extras.hostEmail),
      );
    default:
      return true;
  }
}

export default function BecomeHostGuidedFlow(props: BecomeHostGuidedFlowProps) {
  const {
    guidedStep,
    setGuidedStep,
    isEditMode,
    fieldsToRevise,
    revisionMessage,
    formData,
    handleInputChange,
    handleLocationSelect,
    shouldShowField,
    aiTitleSuggestions,
    aiDraftDescription,
    aiGenerating,
    generateAiTitleAndDescription,
    isReferred,
    setIsReferred,
    enteredReferralCode,
    referralCodeError,
    referrerName,
    onReferralCodeInputChange,
    availableAmenities,
    selectedAmenities,
    toggleAmenity,
    customAmenities,
    setCustomAmenities,
    hasUploadedIdentity,
    identityUploadedInSession,
    onIdentityComplete,
    verificationStatus,
    photosSection,
    paymentSection,
    onOpenCancellationModal,
    cancellationLabel,
    onSubmit,
    loading,
    isSubmitting,
    isPhoneAccount = false,
  } = props;

  const goNextGuided = () => {
    const ok = canGoNextGuided(guidedStep, formData as Record<string, unknown>, {
      hostFullName: formData.hostFullName,
      hostEmail: formData.hostEmail,
      hostPhone: formData.hostPhone,
      isPhoneAccount,
    });
    if (!ok) {
      Alert.alert(
        'Étape incomplète',
        'Merci de compléter les informations demandées avant de continuer.',
      );
      return;
    }
    setGuidedStep((s) => Math.min(GUIDED_STEPS_LABELS.length, s + 1));
  };

  const goPrevGuided = () => {
    setGuidedStep((s) => Math.max(1, s - 1));
  };

  const selectPropertyType = (value: string) => {
    if (!shouldShowField('property_type')) return;
    handleInputChange('propertyType', value);
    setGuidedStep(2);
  };

  const revisionBanner =
    isEditMode && Object.keys(fieldsToRevise).length > 0 ? (
      <View style={styles.revisionCard}>
        <Text style={styles.revisionTitle}>Révision demandée</Text>
        {revisionMessage ? <Text style={styles.revisionMsg}>{revisionMessage}</Text> : null}
        <Text style={styles.revisionHint}>Modifiez uniquement les champs concernés.</Text>
      </View>
    ) : null;

  return (
    <View style={styles.wrapper}>
      {/* Hero — comme BecomeHostPageComplete */}
      <View style={styles.heroOuter}>
        <View style={styles.heroInner}>
          <View style={styles.heroTextCol}>
            <Text style={styles.heroTitle}>
              Publiez votre résidence{' '}
              <Text style={styles.heroAccent}>en toute simplicité</Text>
            </Text>
            <Text style={styles.heroSub}>
              Suivez un parcours guidé, étape par étape, pensé pour les hôtes en Côte d&apos;Ivoire.
            </Text>
          </View>
          <View style={styles.heroTeddyRow}>
            <Image source={teddyAsset} style={styles.heroTeddy} />
            <View>
              <Text style={styles.heroTeddyTitle}>Teddy IA</Text>
              <Text style={styles.heroTeddySub}>Votre copilote pour remplir l&apos;annonce</Text>
            </View>
          </View>
        </View>
      </View>

      {revisionBanner}

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardHeadLeft}>Parcours hôte 🇨🇮</Text>
          <Text style={styles.cardHeadRight}>
            {Math.max(0, guidedStep - 1)}/{GUIDED_STEPS_LABELS.length} révélés
          </Text>
        </View>

        <View style={styles.emojiGrid}>
          {GUIDED_EMOJIS.map((emoji, idx) => {
            const stepNum = idx + 1;
            const discovered = guidedStep > stepNum;
            const current = guidedStep === stepNum;
            return (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.emojiCell,
                  discovered && styles.emojiDiscovered,
                  current && styles.emojiCurrent,
                ]}
                onPress={() => {
                  if (!discovered) {
                    Alert.alert(
                      'Étape verrouillée',
                      "Complétez l'étape en cours puis appuyez sur Suivant pour débloquer cette étape.",
                    );
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.emojiTxt}>{discovered ? emoji : '🔒'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.stepHeading}>{GUIDED_STEPS_LABELS[guidedStep - 1]}</Text>

        <View style={styles.stepBody}>
          {guidedStep === 1 &&
            (isEditMode && !shouldShowField('property_type') ? (
              <Text style={styles.microHint}>
                Le type de logement ne fait pas partie des modifications demandées — passez à l&apos;étape suivante.
              </Text>
            ) : (
              <View>
                <Text style={styles.hintBelowGrid}>Choisis un type pour continuer automatiquement.</Text>
                <View style={styles.typeGrid}>
                  {PROPERTY_TYPES.map((type) => {
                    const sel = formData.propertyType === type.value;
                    return (
                      <TouchableOpacity
                        key={type.value}
                        style={[styles.typeCard, sel && styles.typeCardSel]}
                        onPress={() => selectPropertyType(type.value)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.typeEmoji}>{PROPERTY_ICONS[type.value] || '🏠'}</Text>
                        <Text style={[styles.typeLabel, sel && styles.typeLabelSel]}>{type.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

          {guidedStep === 2 &&
            (!isEditMode ||
              shouldShowField('location') ||
              shouldShowField('max_guests') ||
              shouldShowField('bedrooms') ||
              shouldShowField('bathrooms')) && (
              <View style={styles.gap16}>
                {(!isEditMode || shouldShowField('location')) && (
                  <View>
                    <Text style={styles.fieldLabel}>Localisation *</Text>
                    <CitySearchInputModal
                      value={
                        typeof formData.location === 'string'
                          ? formData.location
                          : (formData.location?.name ?? '')
                      }
                      onChange={handleLocationSelect}
                      placeholder="Rechercher ville, commune ou quartier..."
                    />
                  </View>
                )}
                {(!isEditMode || shouldShowField('max_guests')) && (
                  <View>
                    <Text style={styles.fieldLabel}>Combien de personnes ? *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.chipRow}>
                        {GUEST_OPTIONS.map((n) => {
                          const selected = formData.guests === String(n);
                          return (
                            <TouchableOpacity
                              key={n}
                              style={[styles.chip, selected && styles.chipSel]}
                              onPress={() => handleInputChange('guests', String(n))}
                            >
                              <Text style={[styles.chipTxt, selected && styles.chipTxtSel]}>{n}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                )}
                {(!isEditMode || shouldShowField('bedrooms')) && (
                  <View>
                    <Text style={styles.fieldLabel}>Nombre de chambres *</Text>
                    <View style={styles.chipRowWrap}>
                      {BEDROOM_OPTIONS.map((n) => {
                        const selected = formData.bedrooms === String(n);
                        return (
                          <TouchableOpacity
                            key={n}
                            style={[styles.chip, selected && styles.chipSel]}
                            onPress={() => handleInputChange('bedrooms', String(n))}
                          >
                            <Text style={[styles.chipTxt, selected && styles.chipTxtSel]}>{n}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
                {(!isEditMode || shouldShowField('bathrooms')) && (
                  <View>
                    <Text style={styles.fieldLabel}>Nombre de salles de bain *</Text>
                    <View style={styles.chipRowWrap}>
                      {BATHROOM_OPTIONS.map((n) => {
                        const selected = formData.bathrooms === String(n);
                        return (
                          <TouchableOpacity
                            key={n}
                            style={[styles.chip, selected && styles.chipSel]}
                            onPress={() => handleInputChange('bathrooms', String(n))}
                          >
                            <Text style={[styles.chipTxt, selected && styles.chipTxtSel]}>{n}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            )}

          {guidedStep === 3 &&
            (!isEditMode || shouldShowField('title') || shouldShowField('description')) && (
              <View style={styles.gap16}>
                <View style={styles.teddyAiBanner}>
                  <Text style={styles.teddyAiBannerTxt}>
                    Génération par Teddy IA basée sur les infos déjà saisies.
                  </Text>
                  {(!aiGenerating && (aiTitleSuggestions.length === 0 || !aiDraftDescription)) ? (
                    <TouchableOpacity
                      style={[styles.teddyAiBtn, aiGenerating && styles.btnDisabled]}
                      onPress={generateAiTitleAndDescription}
                      disabled={aiGenerating}
                    >
                      {aiGenerating ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.teddyAiBtnTxt}>
                          {aiTitleSuggestions.length > 0 && !aiDraftDescription
                            ? 'Relancer la description IA'
                            : 'Proposer 3 titres + description'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>

                {(aiTitleSuggestions.length > 0 || aiDraftDescription) && !aiGenerating ? (
                  <View style={styles.teddyProposalCard}>
                    <View style={styles.teddyProposalRow}>
                      <Image source={teddyAsset} style={styles.teddySmall} />
                      <Text style={styles.teddyProposalTxt}>Voici ce que Teddy IA te propose.</Text>
                    </View>
                  </View>
                ) : null}

                {aiGenerating ? (
                  <View style={styles.teddyThinking}>
                    <Image source={teddyAsset} style={styles.teddyThinkingImg} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teddyThinkingTitle}>Teddy réfléchit à tes meilleures propositions…</Text>
                      <Text style={styles.teddyThinkingSub}>
                        Donne-lui quelques secondes pour sortir 3 titres accrocheurs + une description premium.
                      </Text>
                    </View>
                  </View>
                ) : null}

                {aiTitleSuggestions.length > 0 ? (
                  <View>
                    <Text style={styles.fieldLabel}>Titres proposés par l&apos;IA</Text>
                    <Text style={styles.microHint}>Tapez sur un titre pour le choisir.</Text>
                    <View style={styles.titleSuggestions}>
                      {aiTitleSuggestions.map((title, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={styles.titleChip}
                          onPress={() => handleInputChange('title', title)}
                        >
                          <Text style={styles.titleChipTxt}>{title}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}

                {(!isEditMode || shouldShowField('title')) && (
                  <View>
                    <Text style={styles.fieldLabel}>Titre *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.title}
                      onChangeText={(v) => handleInputChange('title', v)}
                      placeholder="Ex: Studio cosy à Cocody"
                      placeholderTextColor="#999"
                    />
                  </View>
                )}
                {(!isEditMode || shouldShowField('description')) && (
                  <View>
                    <Text style={styles.fieldLabel}>Description *</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={formData.description}
                      onChangeText={(v) => handleInputChange('description', v)}
                      placeholder="Décris ton logement simplement…"
                      placeholderTextColor="#999"
                      multiline
                    />
                    {aiDraftDescription ? (
                      <Text style={styles.aiAppliedHint}>Description IA appliquée. Tu peux la modifier librement.</Text>
                    ) : null}
                  </View>
                )}
              </View>
            )}

          {guidedStep === 4 && (!isEditMode || shouldShowField('price_per_night')) && (
            <View style={styles.gap16}>
              <View>
                <Text style={styles.fieldLabel}>Prix par nuit (CFA) *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.price}
                  onChangeText={(v) => handleInputChange('price', v)}
                  placeholder="Ex: 45000"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>
              <View style={styles.discountBox}>
                <TouchableOpacity
                  style={styles.switchRow}
                  onPress={() => handleInputChange('discountEnabled', !formData.discountEnabled)}
                >
                  <View style={[styles.switch, formData.discountEnabled && styles.switchOn]}>
                    <View style={[styles.switchThumb, formData.discountEnabled && styles.switchThumbOn]} />
                  </View>
                  <Text style={styles.switchLabel}>Proposer une réduction longue durée</Text>
                </TouchableOpacity>
                {formData.discountEnabled ? (
                  <View style={styles.row2}>
                    <TextInput
                      style={[styles.input, styles.flex1]}
                      value={formData.discountMinNights}
                      onChangeText={(v) => handleInputChange('discountMinNights', v)}
                      placeholder="Nuits minimum"
                      keyboardType="numeric"
                      placeholderTextColor="#999"
                    />
                    <TextInput
                      style={[styles.input, styles.flex1]}
                      value={formData.discountPercentage}
                      onChangeText={(v) => handleInputChange('discountPercentage', v)}
                      placeholder="% réduction"
                      keyboardType="numeric"
                      placeholderTextColor="#999"
                    />
                  </View>
                ) : null}
              </View>
            </View>
          )}

          {guidedStep === 5 && (
            <View style={styles.gap16}>
              <View>
                <Text style={styles.fieldLabel}>Nom complet *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.hostFullName}
                  onChangeText={(v) => handleInputChange('hostFullName', v)}
                  placeholderTextColor="#999"
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>
                  {isPhoneAccount ? 'Email (optionnel)' : 'Email *'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={formData.hostEmail}
                  onChangeText={(v) => handleInputChange('hostEmail', v)}
                  keyboardType="email-address"
                  placeholder={isPhoneAccount ? 'Ajouter un email (facultatif)' : 'votre@email.com'}
                  placeholderTextColor="#999"
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Téléphone *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.hostPhone}
                  onChangeText={(v) => handleInputChange('hostPhone', v)}
                  keyboardType="phone-pad"
                  placeholderTextColor="#999"
                />
              </View>
              {!isEditMode && (
                <View style={styles.referralBox}>
                  <TouchableOpacity
                    style={styles.switchRow}
                    onPress={() => setIsReferred(!isReferred)}
                  >
                    <View style={[styles.switch, isReferred && styles.switchOn]}>
                      <View style={[styles.switchThumb, isReferred && styles.switchThumbOn]} />
                    </View>
                    <Text style={styles.switchLabel}>J&apos;ai un code de parrainage</Text>
                  </TouchableOpacity>
                  {isReferred ? (
                    <View>
                      <TextInput
                        style={[styles.input, referralCodeError ? styles.inputErr : undefined]}
                        placeholder="Code de parrainage"
                        value={enteredReferralCode}
                        onChangeText={onReferralCodeInputChange}
                        autoCapitalize="characters"
                        placeholderTextColor="#999"
                      />
                      {referralCodeError ? (
                        <Text style={styles.errTxt}>{referralCodeError}</Text>
                      ) : null}
                      {referrerName ? (
                        <Text style={styles.okTxt}>Code valide • Parrain : {referrerName}</Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          )}

          {guidedStep === 6 && (!isEditMode || shouldShowField('amenities')) && (
            <View style={styles.gap16}>
              <View style={styles.amenityGrid}>
                {availableAmenities.map((amenity) => {
                  const on = selectedAmenities.includes(amenity.name);
                  return (
                    <TouchableOpacity
                      key={amenity.id}
                      style={[styles.amenityCell, on && styles.amenityCellOn]}
                      onPress={() => toggleAmenity(amenity.name)}
                    >
                      <Ionicons
                        name={on ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={on ? '#059669' : '#64748b'}
                      />
                      <Text style={styles.amenityName} numberOfLines={2}>
                        {amenity.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View>
                <Text style={styles.fieldLabel}>Autres équipements</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={customAmenities}
                  onChangeText={setCustomAmenities}
                  placeholder="Séparés par des virgules"
                  placeholderTextColor="#999"
                  multiline
                />
              </View>
            </View>
          )}

          {guidedStep === 7 && (
            <View style={styles.gap16}>
              <View style={styles.row2}>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLabel}>Frais de ménage</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.cleaningFee}
                    onChangeText={(v) => handleInputChange('cleaningFee', v)}
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLabel}>Nuits minimum</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.minimumNights}
                    onChangeText={(v) => handleInputChange('minimumNights', v)}
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>
              <View style={styles.row2}>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLabel}>Heure d&apos;arrivée</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.checkInTime}
                    onChangeText={(v) => handleInputChange('checkInTime', v)}
                    placeholder="14:00"
                    placeholderTextColor="#999"
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLabel}>Heure de départ</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.checkOutTime}
                    onChangeText={(v) => handleInputChange('checkOutTime', v)}
                    placeholder="11:00"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Type de réservation *</Text>
              <View style={styles.segmentRow}>
                <TouchableOpacity
                  style={[styles.segment, formData.autoBooking === 'request' && styles.segmentOn]}
                  onPress={() => handleInputChange('autoBooking', 'request')}
                >
                  <Text style={[styles.segmentTxt, formData.autoBooking === 'request' && styles.segmentTxtOn]}>
                    Demande (vous validez)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segment, formData.autoBooking === 'auto' && styles.segmentOn]}
                  onPress={() => handleInputChange('autoBooking', 'auto')}
                >
                  <Text style={[styles.segmentTxt, formData.autoBooking === 'auto' && styles.segmentTxtOn]}>
                    Automatique
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.selectLikeBtn} onPress={onOpenCancellationModal}>
                <Text style={styles.selectLikeBtnTxt}>{cancellationLabel}</Text>
                <Ionicons name="chevron-down" size={20} color="#64748b" />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Règlement du logement</Text>
              <TouchableOpacity style={styles.ruleToggle} onPress={() => handleInputChange('allowPets', !formData.allowPets)}>
                <Ionicons name={formData.allowPets ? 'checkbox' : 'square-outline'} size={22} color="#059669" />
                <Text style={styles.ruleTxt}>Animaux autorisés</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ruleToggle} onPress={() => handleInputChange('allowSmoking', !formData.allowSmoking)}>
                <Ionicons name={formData.allowSmoking ? 'checkbox' : 'square-outline'} size={22} color="#059669" />
                <Text style={styles.ruleTxt}>Fumer autorisé</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ruleToggle} onPress={() => handleInputChange('allowEvents', !formData.allowEvents)}>
                <Ionicons name={formData.allowEvents ? 'checkbox' : 'square-outline'} size={22} color="#059669" />
                <Text style={styles.ruleTxt}>Événements autorisés</Text>
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Autres règles</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.otherRules}
                onChangeText={(v) => handleInputChange('otherRules', v)}
                multiline
                placeholderTextColor="#999"
              />
            </View>
          )}

          {guidedStep === 8 && (
            <View style={styles.gap16}>
              <Text style={styles.sectionHdr}>Photos du logement *</Text>
              {photosSection}

              <Text style={styles.sectionHdr}>Vérification d&apos;identité *</Text>
              {hasUploadedIdentity ||
              identityUploadedInSession ||
              verificationStatus === 'verified' ? (
                <View style={styles.identityOk}>
                  <Text style={styles.identityOkTxt}>Identité déjà vérifiée.</Text>
                </View>
              ) : (
                <IdentityVerificationAlert onVerificationComplete={onIdentityComplete} />
              )}
              {verificationStatus === 'pending' ? (
                <Text style={styles.microHint}>
                  Vous pouvez soumettre : la validation finale sera faite par notre équipe.
                </Text>
              ) : null}

              {paymentSection}

              <TouchableOpacity
                style={styles.ruleToggle}
                onPress={() => handleInputChange('agreeTerms', !formData.agreeTerms)}
              >
                <Ionicons name={formData.agreeTerms ? 'checkbox' : 'square-outline'} size={22} color="#059669" />
                <Text style={styles.ruleTxt}>
                  J&apos;accepte les conditions générales d&apos;utilisation d&apos;AkwaHome.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, (!formData.agreeTerms || loading || isSubmitting) && styles.btnDisabled]}
                onPress={onSubmit}
                disabled={!formData.agreeTerms || loading || isSubmitting}
              >
                {loading || isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnTxt}>Soumettre ma candidature</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtnOutline, guidedStep === 1 && styles.btnDisabled]}
            onPress={goPrevGuided}
            disabled={guidedStep === 1}
          >
            <Text style={styles.navBtnOutlineTxt}>Précédent</Text>
          </TouchableOpacity>
          {guidedStep < GUIDED_STEPS_LABELS.length ? (
            <TouchableOpacity style={styles.navBtnPrimary} onPress={goNextGuided}>
              <Text style={styles.navBtnPrimaryTxt}>Suivant</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.lastStepHint}>Dernière étape</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 24 },
  heroOuter: {
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  heroInner: {
    padding: 20,
    backgroundColor: 'rgba(236,253,245,0.35)',
  },
  heroTextCol: { marginBottom: 16 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#0f172a', lineHeight: 32 },
  heroAccent: { color: '#ea580c' },
  heroSub: { marginTop: 8, fontSize: 14, color: '#475569', lineHeight: 20 },
  heroTeddyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'flex-start',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  heroTeddy: { width: 48, height: 48, borderRadius: 24 },
  heroTeddyTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  heroTeddySub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  revisionCard: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fefce8',
    borderWidth: 1,
    borderColor: '#fde047',
  },
  revisionTitle: { fontWeight: '700', color: '#713f12', marginBottom: 6 },
  revisionMsg: { fontSize: 14, color: '#854d0e', marginBottom: 8 },
  revisionHint: { fontSize: 12, color: '#a16207' },
  card: {
    marginHorizontal: 12,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardHeadLeft: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  cardHeadRight: { fontSize: 11, color: '#64748b' },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    rowGap: 5,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  emojiCell: {
    width: '23%',
    maxWidth: 42,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiDiscovered: { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' },
  emojiCurrent: {
    backgroundColor: '#fff',
    borderColor: '#fb923c',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  emojiTxt: { fontSize: 13, lineHeight: 16 },
  stepHeading: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  stepBody: { minHeight: 80 },
  hintBelowGrid: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: {
    width: '47%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  typeCardSel: { borderColor: '#34d399', backgroundColor: '#ecfdf5' },
  typeEmoji: { fontSize: 22, marginBottom: 6 },
  typeLabel: { fontSize: 14, fontWeight: '600', color: '#334155' },
  typeLabelSel: { color: '#065f46' },
  gap16: { gap: 16 },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 8 },
  microHint: { fontSize: 11, color: '#64748b', marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minWidth: 42,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  chipSel: { borderColor: '#34d399', backgroundColor: '#ecfdf5' },
  chipTxt: { fontSize: 14, fontWeight: '600', color: '#334155', textAlign: 'center' },
  chipTxtSel: { color: '#065f46' },
  teddyAiBanner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
  },
  teddyAiBannerTxt: { fontSize: 13, color: '#065f46', marginBottom: 10 },
  teddyAiBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  teddyAiBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  teddyProposalCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#fff',
  },
  teddyProposalRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teddySmall: { width: 36, height: 36, borderRadius: 18 },
  teddyProposalTxt: { fontSize: 14, fontWeight: '600', color: '#065f46', flex: 1 },
  teddyThinking: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
  },
  teddyThinkingImg: { width: 48, height: 48, borderRadius: 24 },
  teddyThinkingTitle: { fontSize: 14, fontWeight: '700', color: '#9a3412' },
  teddyThinkingSub: { fontSize: 11, color: '#c2410c', marginTop: 4 },
  titleSuggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  titleChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    maxWidth: '100%',
  },
  titleChipTxt: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fff',
  },
  inputErr: { borderColor: '#dc2626' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  aiAppliedHint: { fontSize: 11, color: '#047857', marginTop: 6 },
  discountBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e5e7eb',
    padding: 2,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: '#059669' },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  switchThumbOn: { alignSelf: 'flex-end' },
  switchLabel: { flex: 1, fontSize: 14, color: '#334155' },
  row2: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  referralBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  errTxt: { fontSize: 12, color: '#dc2626', marginTop: 6 },
  okTxt: { fontSize: 12, color: '#047857', marginTop: 6 },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityCell: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  amenityCellOn: { borderColor: '#a7f3d0', backgroundColor: '#f0fdf4' },
  amenityName: { flex: 1, fontSize: 13, color: '#334155' },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  segmentOn: { borderColor: '#059669', backgroundColor: '#ecfdf5' },
  segmentTxt: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  segmentTxtOn: { color: '#065f46' },
  selectLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fafafa',
  },
  selectLikeBtnTxt: { fontSize: 15, color: '#111', flex: 1 },
  ruleToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  ruleTxt: { flex: 1, fontSize: 14, color: '#334155' },
  sectionHdr: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  identityOk: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  identityOkTxt: { fontSize: 14, color: '#166534' },
  submitBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  btnDisabled: { opacity: 0.5 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  navBtnOutline: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  navBtnOutlineTxt: { fontWeight: '700', color: '#475569', fontSize: 14 },
  navBtnPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: '#0f172a',
  },
  navBtnPrimaryTxt: { fontWeight: '700', color: '#fff', fontSize: 14 },
  lastStepHint: { fontSize: 11, color: '#94a3b8' },
});
