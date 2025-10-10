const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAvailabilitySystem() {
  try {
    console.log('🔍 Test du système de disponibilités...\n');

    // 1. Vérifier la fonction get_unavailable_dates
    console.log('📅 Test de la fonction get_unavailable_dates...');
    
    // Récupérer une propriété pour tester
    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('id, title')
      .limit(1);

    if (propertiesError) {
      console.error('❌ Erreur lors de la récupération des propriétés:', propertiesError);
      return;
    }

    if (!properties || properties.length === 0) {
      console.log('⚠️  Aucune propriété trouvée pour le test');
      return;
    }

    const testProperty = properties[0];
    console.log(`✅ Propriété de test: ${testProperty.title} (ID: ${testProperty.id})`);

    // Test de la fonction RPC
    const { data: unavailableDates, error: rpcError } = await supabase.rpc('get_unavailable_dates', {
      property_id_param: testProperty.id
    });

    if (rpcError) {
      console.error('❌ Erreur lors de l\'appel de get_unavailable_dates:', rpcError);
    } else {
      console.log(`✅ Fonction get_unavailable_dates fonctionne - ${unavailableDates.length} période(s) indisponible(s)`);
      if (unavailableDates.length > 0) {
        unavailableDates.forEach((period, index) => {
          console.log(`   ${index + 1}. ${period.start_date} → ${period.end_date} (${period.reason})`);
        });
      }
    }

    // 2. Vérifier la table blocked_dates
    console.log('\n🚫 Test de la table blocked_dates...');
    
    const { data: blockedDates, error: blockedError } = await supabase
      .from('blocked_dates')
      .select('*')
      .eq('property_id', testProperty.id);

    if (blockedError) {
      console.error('❌ Erreur lors de la récupération des dates bloquées:', blockedError);
    } else {
      console.log(`✅ Table blocked_dates accessible - ${blockedDates.length} date(s) bloquée(s)`);
      if (blockedDates.length > 0) {
        blockedDates.forEach((blocked, index) => {
          console.log(`   ${index + 1}. ${blocked.start_date} → ${blocked.end_date} (${blocked.reason || 'Sans raison'})`);
        });
      }
    }

    // 3. Vérifier la table bookings
    console.log('\n📋 Test de la table bookings...');
    
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, check_in_date, check_out_date, status')
      .eq('property_id', testProperty.id)
      .in('status', ['pending', 'confirmed']);

    if (bookingsError) {
      console.error('❌ Erreur lors de la récupération des réservations:', bookingsError);
    } else {
      console.log(`✅ Table bookings accessible - ${bookings.length} réservation(s) active(s)`);
      if (bookings.length > 0) {
        bookings.forEach((booking, index) => {
          console.log(`   ${index + 1}. ${booking.check_in_date} → ${booking.check_out_date} (${booking.status})`);
        });
      }
    }

    // 4. Test de disponibilité pour une date spécifique
    console.log('\n🎯 Test de disponibilité pour une date spécifique...');
    
    const testDate = '2025-01-15'; // Date de test
    console.log(`Test de disponibilité pour le ${testDate}...`);

    // Vérifier si cette date est dans une période indisponible
    const isUnavailable = [...(unavailableDates || []), ...(blockedDates || [])].some(({ start_date, end_date }) => {
      return testDate >= start_date && testDate <= end_date;
    });

    console.log(`📅 Date ${testDate}: ${isUnavailable ? '❌ Indisponible' : '✅ Disponible'}`);

    // 5. Statistiques générales
    console.log('\n📊 Statistiques générales:');
    
    const { count: totalBlockedDates } = await supabase
      .from('blocked_dates')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'confirmed']);

    console.log(`   - Dates bloquées totales: ${totalBlockedDates || 0}`);
    console.log(`   - Réservations actives: ${totalBookings || 0}`);

    console.log('\n✅ Test du système de disponibilités terminé avec succès !');

  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
  }
}

// Exécuter le test
testAvailabilitySystem();
