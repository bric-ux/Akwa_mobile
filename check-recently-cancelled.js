const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentlyCancelled() {
  try {
    console.log('🔍 Vérification des réservations récemment annulées...\n');

    // Réservations de propriétés annulées dans les 7 derniers jours
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log('📋 RÉSERVATIONS DE PROPRIÉTÉS ANNULÉES (7 derniers jours)');
    console.log('='.repeat(60));
    const { data: cancelledBookings, error: cancelledError } = await supabase
      .from('bookings')
      .select(`
        id,
        property_id,
        check_in_date,
        check_out_date,
        status,
        cancellation_reason,
        cancelled_at,
        created_at,
        properties:property_id (
          title
        )
      `)
      .eq('status', 'cancelled')
      .gte('cancelled_at', sevenDaysAgo.toISOString())
      .order('cancelled_at', { ascending: false })
      .limit(20);

    if (cancelledError) {
      console.error('❌ Erreur:', cancelledError);
    } else {
      console.log(`📊 Total: ${cancelledBookings?.length || 0} réservation(s) annulée(s) récemment\n`);
      
      if (cancelledBookings && cancelledBookings.length > 0) {
        cancelledBookings.forEach((booking, index) => {
          const createdDate = new Date(booking.created_at);
          const cancelledDate = booking.cancelled_at ? new Date(booking.cancelled_at) : null;
          const hoursBetween = cancelledDate ? Math.floor((cancelledDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60)) : 0;
          const isAutoCancelled = booking.cancellation_reason?.includes('automatiquement');
          
          console.log(`${index + 1}. ${isAutoCancelled ? '🤖 AUTO' : '👤 MANUEL'} - Réservation ${booking.id.substring(0, 8)}`);
          console.log(`   Propriété: ${booking.properties?.title || 'N/A'}`);
          console.log(`   Dates: ${booking.check_in_date} → ${booking.check_out_date}`);
          console.log(`   Créée le: ${createdDate.toLocaleString('fr-FR')}`);
          if (cancelledDate) {
            console.log(`   Annulée le: ${cancelledDate.toLocaleString('fr-FR')}`);
            console.log(`   Durée avant annulation: ${hoursBetween}h`);
          }
          console.log(`   Raison: ${booking.cancellation_reason || 'Non spécifiée'}`);
          console.log('');
        });
      } else {
        console.log('✅ Aucune réservation annulée récemment\n');
      }
    }

    // Réservations de véhicules annulées
    console.log('\n📋 RÉSERVATIONS DE VÉHICULES ANNULÉES (7 derniers jours)');
    console.log('='.repeat(60));
    const { data: cancelledVehicleBookings, error: cancelledVehicleError } = await supabase
      .from('vehicle_bookings')
      .select(`
        id,
        vehicle_id,
        start_date,
        end_date,
        status,
        cancellation_reason,
        cancelled_at,
        created_at,
        vehicle:vehicles (
          title
        )
      `)
      .eq('status', 'cancelled')
      .gte('cancelled_at', sevenDaysAgo.toISOString())
      .order('cancelled_at', { ascending: false })
      .limit(20);

    if (cancelledVehicleError) {
      console.error('❌ Erreur:', cancelledVehicleError);
    } else {
      console.log(`📊 Total: ${cancelledVehicleBookings?.length || 0} réservation(s) de véhicule annulée(s) récemment\n`);
      
      if (cancelledVehicleBookings && cancelledVehicleBookings.length > 0) {
        cancelledVehicleBookings.forEach((booking, index) => {
          const createdDate = new Date(booking.created_at);
          const cancelledDate = booking.cancelled_at ? new Date(booking.cancelled_at) : null;
          const hoursBetween = cancelledDate ? Math.floor((cancelledDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60)) : 0;
          const isAutoCancelled = booking.cancellation_reason?.includes('automatiquement');
          
          console.log(`${index + 1}. ${isAutoCancelled ? '🤖 AUTO' : '👤 MANUEL'} - Réservation ${booking.id.substring(0, 8)}`);
          console.log(`   Véhicule: ${booking.vehicle?.title || 'N/A'}`);
          console.log(`   Dates: ${booking.start_date} → ${booking.end_date}`);
          console.log(`   Créée le: ${createdDate.toLocaleString('fr-FR')}`);
          if (cancelledDate) {
            console.log(`   Annulée le: ${cancelledDate.toLocaleString('fr-FR')}`);
            console.log(`   Durée avant annulation: ${hoursBetween}h`);
          }
          console.log(`   Raison: ${booking.cancellation_reason || 'Non spécifiée'}`);
          console.log('');
        });
      } else {
        console.log('✅ Aucune réservation de véhicule annulée récemment\n');
      }
    }

    // Demandes de modification annulées
    console.log('\n📋 DEMANDES DE MODIFICATION ANNULÉES (7 derniers jours)');
    console.log('='.repeat(60));
    const { data: cancelledModRequests, error: cancelledModError } = await supabase
      .from('booking_modification_requests')
      .select(`
        id,
        booking_id,
        status,
        created_at,
        updated_at
      `)
      .eq('status', 'cancelled')
      .gte('updated_at', sevenDaysAgo.toISOString())
      .order('updated_at', { ascending: false })
      .limit(20);

    if (cancelledModError) {
      console.error('❌ Erreur:', cancelledModError);
    } else {
      console.log(`📊 Total: ${cancelledModRequests?.length || 0} demande(s) de modification annulée(s) récemment\n`);
      
      if (cancelledModRequests && cancelledModRequests.length > 0) {
        cancelledModRequests.forEach((request, index) => {
          const createdDate = new Date(request.created_at);
          const cancelledDate = request.updated_at ? new Date(request.updated_at) : null;
          const hoursBetween = cancelledDate ? Math.floor((cancelledDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60)) : 0;
          
          console.log(`${index + 1}. Demande ${request.id.substring(0, 8)}`);
          console.log(`   Réservation: ${request.booking_id.substring(0, 8)}`);
          console.log(`   Créée le: ${createdDate.toLocaleString('fr-FR')}`);
          if (cancelledDate) {
            console.log(`   Annulée le: ${cancelledDate.toLocaleString('fr-FR')}`);
            console.log(`   Durée avant annulation: ${hoursBetween}h ${hoursBetween >= 24 ? '(expiration automatique probable)' : ''}`);
          }
          console.log('');
        });
      } else {
        console.log('✅ Aucune demande de modification annulée récemment\n');
      }
    }

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  }
}

checkRecentlyCancelled();












