import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { formatAmount } from '../utils/priceCalculator';

type BookingType = 'property' | 'vehicle';
type SearchResult = {
  type: BookingType;
  booking: any;
  property?: any;
  vehicle?: any;
  host?: any;
  guest?: any;
  modifications: any[];
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AdminBookingManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseSearchInput = (input: string): string => {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return '';
    // UUID complet
    if (UUID_REGEX.test(trimmed)) return trimmed;
    // Format akwa-XXXX ou akwaXXXX - extraire la partie identifiante
    const akwaMatch = trimmed.match(/akwa-?([a-z0-9]+)/i);
    if (akwaMatch) return akwaMatch[1];
    // Partie d'UUID (8 premiers caractères par ex.)
    return trimmed.replace(/[^a-z0-9]/g, '');
  };

  const searchBooking = async () => {
    const parsed = parseSearchInput(searchInput);
    console.log('🔍 [AdminBookingManagement] Recherche:', { searchInput, parsed, isUUID: UUID_REGEX.test(parsed) });

    if (!parsed) {
      Alert.alert('Champ requis', 'Veuillez saisir un numéro de réservation (ex: akwa-XXXXXXXX ou UUID complet)');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Recherche par UUID exact
      if (UUID_REGEX.test(parsed)) {
        console.log('🔍 [AdminBookingManagement] Branche UUID exact');
        const [propertyResult, vehicleResult] = await Promise.all([
          supabase
            .from('bookings')
            .select(`
              *,
              property:properties(id, title, address, host_id),
              guest:profiles!bookings_guest_id_fkey(first_name, last_name, email, phone)
            `)
            .eq('id', parsed)
            .single(),
          supabase
            .from('vehicle_bookings')
            .select(`
              *,
              vehicle:vehicles(id, title, brand, model, owner_id),
              renter:profiles!vehicle_bookings_renter_id_fkey(first_name, last_name, email, phone)
            `)
            .eq('id', parsed)
            .single(),
        ]);

        console.log('🔍 [AdminBookingManagement] Résultats UUID:', {
          property: { data: !!propertyResult.data, error: propertyResult.error?.message },
          vehicle: { data: !!vehicleResult.data, error: vehicleResult.error?.message },
        });

        if (propertyResult.data && !propertyResult.error) {
          const hostRes = await supabase
            .from('profiles')
            .select('first_name, last_name, email, phone')
            .eq('user_id', propertyResult.data.property?.host_id)
            .single();
          const modRes = await supabase
            .from('booking_modification_requests')
            .select('*')
            .eq('booking_id', propertyResult.data.id)
            .order('created_at', { ascending: false });
          setResult({
            type: 'property',
            booking: propertyResult.data,
            property: propertyResult.data.property,
            host: hostRes.data,
            guest: propertyResult.data.guest,
            modifications: modRes.data || [],
          });
          return;
        }
        if (vehicleResult.data && !vehicleResult.error) {
          const ownerRes = await supabase
            .from('profiles')
            .select('first_name, last_name, email, phone')
            .eq('user_id', vehicleResult.data.vehicle?.owner_id)
            .single();
          const modRes = await supabase
            .from('vehicle_booking_modification_requests')
            .select('*')
            .eq('booking_id', vehicleResult.data.id)
            .order('created_at', { ascending: false });
          setResult({
            type: 'vehicle',
            booking: vehicleResult.data,
            vehicle: vehicleResult.data.vehicle,
            host: ownerRes.data,
            guest: vehicleResult.data.renter,
            modifications: modRes.data || [],
          });
          return;
        }
      } else {
        // Recherche par code AKWA uniquement (booking_code / vehicle_booking_code)
        // Note: on n'utilise pas id.like car UUID ne supporte pas LIKE en PostgreSQL
        const codePattern = `%${parsed}%`;
        console.log('🔍 [AdminBookingManagement] Branche code AKWA:', { codePattern });

        const [propertyList, vehicleList] = await Promise.all([
          supabase
            .from('bookings')
            .select(`
              *,
              property:properties(id, title, address, host_id),
              guest:profiles!bookings_guest_id_fkey(first_name, last_name, email, phone)
            `)
            .ilike('booking_code', codePattern)
            .limit(1),
          supabase
            .from('vehicle_bookings')
            .select(`
              *,
              vehicle:vehicles(id, title, brand, model, owner_id),
              renter:profiles!vehicle_bookings_renter_id_fkey(first_name, last_name, email, phone)
            `)
            .ilike('vehicle_booking_code', codePattern)
            .limit(1),
        ]);

        console.log('🔍 [AdminBookingManagement] Résultats code AKWA:', {
          property: { count: propertyList.data?.length ?? 0, error: propertyList.error?.message, data: propertyList.data?.[0]?.id },
          vehicle: { count: vehicleList.data?.length ?? 0, error: vehicleList.error?.message, data: vehicleList.data?.[0]?.id },
        });
        if (propertyList.error) console.log('🔍 [AdminBookingManagement] Erreur propertyList:', propertyList.error);
        if (vehicleList.error) console.log('🔍 [AdminBookingManagement] Erreur vehicleList:', vehicleList.error);

        if (propertyList.data && propertyList.data.length > 0) {
          const b = propertyList.data[0];
          const hostRes = await supabase
            .from('profiles')
            .select('first_name, last_name, email, phone')
            .eq('user_id', b.property?.host_id)
            .single();
          const modRes = await supabase
            .from('booking_modification_requests')
            .select('*')
            .eq('booking_id', b.id)
            .order('created_at', { ascending: false });
          setResult({
            type: 'property',
            booking: b,
            property: b.property,
            host: hostRes.data,
            guest: b.guest,
            modifications: modRes.data || [],
          });
          return;
        }
        if (vehicleList.data && vehicleList.data.length > 0) {
          const b = vehicleList.data[0];
          const ownerRes = await supabase
            .from('profiles')
            .select('first_name, last_name, email, phone')
            .eq('user_id', b.vehicle?.owner_id)
            .single();
          const modRes = await supabase
            .from('vehicle_booking_modification_requests')
            .select('*')
            .eq('booking_id', b.id)
            .order('created_at', { ascending: false });
          setResult({
            type: 'vehicle',
            booking: b,
            vehicle: b.vehicle,
            host: ownerRes.data,
            guest: b.renter,
            modifications: modRes.data || [],
          });
          return;
        }
      }

      console.log('🔍 [AdminBookingManagement] Aucun résultat trouvé');
      setError('Aucune réservation trouvée pour ce numéro.');
    } catch (err: any) {
      console.error('🔍 [AdminBookingManagement] Erreur recherche réservation:', err);
      setError(err.message || 'Une erreur est survenue lors de la recherche.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getReservationRef = () => {
    if (!result) return '';
    const b = result.booking as any;
    const code = result.type === 'vehicle' ? b.vehicle_booking_code : b.booking_code;
    return code || `AKWA-${(result.booking.id || '').toString().substring(0, 8).toUpperCase()}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion réservation</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.searchCard}>
          <Text style={styles.searchLabel}>Numéro de réservation</Text>
          <Text style={styles.searchHint}>
            Format : AKWA-XXXXXXXX ou UUID complet (ex: akwa-a1b2c3d4)
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: akwa-a1b2c3d4 ou UUID"
            placeholderTextColor="#999"
            value={searchInput}
            onChangeText={(t) => { setSearchInput(t); setError(null); setResult(null); }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.searchButton, loading && styles.searchButtonDisabled]}
            onPress={searchBooking}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="search-outline" size={20} color="#fff" />
                <Text style={styles.searchButtonText}>Rechercher</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={24} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {result && (
          <ScrollView style={styles.resultScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Ionicons
                  name={result.type === 'vehicle' ? 'car-outline' : 'home-outline'}
                  size={24}
                  color={result.type === 'vehicle' ? '#e67e22' : '#3498db'}
                />
                <View style={styles.resultHeaderText}>
                  <Text style={styles.reservationRef}>{getReservationRef()}</Text>
                  <Text style={styles.resultType}>
                    {result.type === 'vehicle' ? 'Location véhicule' : 'Résidence meublée'}
                  </Text>
                  <Text style={styles.resultStatus}>Statut : {result.booking.status}</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Réservation initiale</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Objet</Text>
                  <Text style={styles.infoValue}>
                    {result.type === 'vehicle'
                      ? `${result.vehicle?.brand || ''} ${result.vehicle?.model || ''}`.trim() || result.vehicle?.title || '-'
                      : result.property?.title || '-'}
                  </Text>
                </View>
                {result.type === 'property' ? (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Dates</Text>
                      <Text style={styles.infoValue}>
                        {formatDate(result.booking.check_in_date)} - {formatDate(result.booking.check_out_date)}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Voyageurs</Text>
                      <Text style={styles.infoValue}>{result.booking.guests_count || '-'}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Dates</Text>
                      <Text style={styles.infoValue}>
                        {formatDate(result.booking.start_date)} - {formatDate(result.booking.end_date)}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Jours / Heures</Text>
                      <Text style={styles.infoValue}>
                        {result.booking.rental_days} jour(s)
                        {result.booking.rental_hours ? `, ${result.booking.rental_hours} h` : ''}
                      </Text>
                    </View>
                  </>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Montant total</Text>
                  <Text style={[styles.infoValue, styles.amountHighlight]}>
                    {formatAmount(result.booking.total_price ?? 0)}
                  </Text>
                </View>
                {result.booking.original_total != null && result.booking.original_total !== result.booking.total_price && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Montant initial</Text>
                    <Text style={styles.infoValue}>{formatAmount(result.booking.original_total)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {result.type === 'vehicle' ? 'Propriétaire' : 'Hôte'}
                </Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nom</Text>
                  <Text style={styles.infoValue}>
                    {result.host ? `${result.host.first_name || ''} ${result.host.last_name || ''}`.trim() : '-'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{result.host?.email || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Téléphone</Text>
                  <Text style={styles.infoValue}>{result.host?.phone || '-'}</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {result.type === 'vehicle' ? 'Locataire' : 'Voyageur'}
                </Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nom</Text>
                  <Text style={styles.infoValue}>
                    {result.guest ? `${result.guest.first_name || ''} ${result.guest.last_name || ''}`.trim() : '-'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{result.guest?.email || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Téléphone</Text>
                  <Text style={styles.infoValue}>{result.guest?.phone || '-'}</Text>
                </View>
              </View>

              {result.modifications.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Modifications ({result.modifications.length})
                  </Text>
                  {result.modifications.map((mod: any, idx: number) => (
                    <View key={mod.id || idx} style={styles.modificationCard}>
                      <View style={styles.modHeader}>
                        <Text style={styles.modStatus}>Statut : {mod.status}</Text>
                        <Text style={styles.modDate}>{formatDate(mod.created_at)}</Text>
                      </View>
                      {result.type === 'property' ? (
                        <>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Dates initiales</Text>
                            <Text style={styles.infoValue}>
                              {formatDate(mod.original_check_in)} → {formatDate(mod.original_check_out)}
                            </Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Dates demandées</Text>
                            <Text style={styles.infoValue}>
                              {formatDate(mod.requested_check_in)} → {formatDate(mod.requested_check_out)}
                            </Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Montant initial</Text>
                            <Text style={styles.infoValue}>{formatAmount(mod.original_total_price)}</Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Montant demandé</Text>
                            <Text style={styles.infoValue}>{formatAmount(mod.requested_total_price)}</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Période initiale</Text>
                            <Text style={styles.infoValue}>
                              {formatDate(mod.original_start_date)} → {formatDate(mod.original_end_date)}
                            </Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Période demandée</Text>
                            <Text style={styles.infoValue}>
                              {formatDate(mod.requested_start_date)} → {formatDate(mod.requested_end_date)}
                            </Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Montant initial</Text>
                            <Text style={styles.infoValue}>{formatAmount(mod.original_total_price)}</Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Montant demandé</Text>
                            <Text style={styles.infoValue}>{formatAmount(mod.requested_total_price)}</Text>
                          </View>
                          {mod.surplus_amount != null && mod.surplus_amount > 0 && (
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Surplus à régler</Text>
                              <Text style={[styles.infoValue, styles.amountHighlight]}>
                                {formatAmount(mod.surplus_amount)}
                              </Text>
                            </View>
                          )}
                        </>
                      )}
                      {mod.guest_message && (
                        <View style={styles.messageBox}>
                          <Text style={styles.messageLabel}>Message voyageur</Text>
                          <Text style={styles.messageText}>{mod.guest_message}</Text>
                        </View>
                      )}
                      {(mod.renter_message || mod.host_response_message || mod.owner_response_message) && (
                        <View style={styles.messageBox}>
                          <Text style={styles.messageLabel}>Réponse hôte/propriétaire</Text>
                          <Text style={styles.messageText}>
                            {mod.renter_message || mod.host_response_message || mod.owner_response_message}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: { padding: 4 },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  searchHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e67e22',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  searchButtonDisabled: {
    opacity: 0.7,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
    gap: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    flex: 1,
  },
  resultScroll: {
    flex: 1,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  reservationRef: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  resultType: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  resultStatus: {
    fontSize: 13,
    color: '#e67e22',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  amountHighlight: {
    color: '#e67e22',
    fontWeight: 'bold',
  },
  modificationCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  modHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  modDate: {
    fontSize: 12,
    color: '#666',
  },
  messageBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  messageLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 13,
    color: '#333',
  },
});

export default AdminBookingManagementScreen;
