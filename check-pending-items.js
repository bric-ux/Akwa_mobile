const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPendingItems() {
  try {
    console.log('🔍 Vérification des réservations et demandes en attente...\n');

    // 1. Réservations de propriétés en attente
    console.log('📋 1. RÉSERVATIONS DE PROPRIÉTÉS EN ATTENTE');
    console.log('='.repeat(60));
    const { data: pendingBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        guest_id,
        property_id,
        check_in_date,
        check_out_date,
        guests_count,
        total_price,
        status,
        created_at,
        properties:property_id (
          title,
          host_id
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (bookingsError) {
      console.error('❌ Erreur:', bookingsError);
    } else {
      console.log(`📊 Total: ${pendingBookings?.length || 0} réservation(s) en attente\n`);
      
      if (pendingBookings && pendingBookings.length > 0) {
        const now = new Date();
        pendingBookings.forEach((booking, index) => {
          const createdDate = new Date(booking.created_at);
          const hoursSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60));
          const isExpired = hoursSinceCreation >= 24;
          
          console.log(`${index + 1}. ${isExpired ? '🔴 EXPIRÉE' : '🟡 EN ATTENTE'} - Réservation ${booking.id.substring(0, 8)}`);
          console.log(`   Propriété: ${booking.properties?.title || 'N/A'}`);
          console.log(`   Dates: ${booking.check_in_date} → ${booking.check_out_date}`);
          console.log(`   Voyageurs: ${booking.guests_count}`);
          console.log(`   Montant: ${booking.total_price?.toLocaleString('fr-FR')} FCFA`);
          console.log(`   Créée le: ${createdDate.toLocaleString('fr-FR')}`);
          console.log(`   ${isExpired ? `⚠️  Créée il y a ${hoursSinceCreation}h (> 24h - DEVRAIT ÊTRE ANNULÉE)` : `Créée il y a ${hoursSinceCreation}h (< 24h)`}`);
          console.log('');
        });
      } else {
        console.log('✅ Aucune réservation de propriété en attente\n');
      }
    }

    // 2. Réservations de véhicules en attente
    console.log('\n📋 2. RÉSERVATIONS DE VÉHICULES EN ATTENTE');
    console.log('='.repeat(60));
    const { data: pendingVehicleBookings, error: vehicleBookingsError } = await supabase
      .from('vehicle_bookings')
      .select(`
        id,
        renter_id,
        vehicle_id,
        start_date,
        end_date,
        rental_days,
        total_price,
        status,
        created_at,
        vehicle:vehicles (
          title,
          owner_id
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (vehicleBookingsError) {
      console.error('❌ Erreur:', vehicleBookingsError);
    } else {
      console.log(`📊 Total: ${pendingVehicleBookings?.length || 0} réservation(s) de véhicule en attente\n`);
      
      if (pendingVehicleBookings && pendingVehicleBookings.length > 0) {
        const now = new Date();
        pendingVehicleBookings.forEach((booking, index) => {
          const createdDate = new Date(booking.created_at);
          const hoursSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60));
          const isExpired = hoursSinceCreation >= 24;
          
          console.log(`${index + 1}. ${isExpired ? '🔴 EXPIRÉE' : '🟡 EN ATTENTE'} - Réservation ${booking.id.substring(0, 8)}`);
          console.log(`   Véhicule: ${booking.vehicle?.title || 'N/A'}`);
          console.log(`   Dates: ${booking.start_date} → ${booking.end_date}`);
          console.log(`   Jours: ${booking.rental_days}`);
          console.log(`   Montant: ${booking.total_price?.toLocaleString('fr-FR')} FCFA`);
          console.log(`   Créée le: ${createdDate.toLocaleString('fr-FR')}`);
          console.log(`   ${isExpired ? `⚠️  Créée il y a ${hoursSinceCreation}h (> 24h - DEVRAIT ÊTRE ANNULÉE)` : `Créée il y a ${hoursSinceCreation}h (< 24h)`}`);
          console.log('');
        });
      } else {
        console.log('✅ Aucune réservation de véhicule en attente\n');
      }
    }

    // 3. Demandes de modification de réservation (propriétés)
    console.log('\n📋 3. DEMANDES DE MODIFICATION DE RÉSERVATION (PROPRIÉTÉS)');
    console.log('='.repeat(60));
    
    // D'abord, essayer sans la relation pour éviter les problèmes RLS
    const { data: pendingModRequests, error: modRequestsError } = await supabase
      .from('booking_modification_requests')
      .select(`
        id,
        booking_id,
        guest_id,
        host_id,
        requested_check_in,
        requested_check_out,
        requested_total_price,
        status,
        created_at,
        guest_message
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (modRequestsError) {
      console.error('❌ Erreur:', modRequestsError);
    } else {
      console.log(`📊 Total: ${pendingModRequests?.length || 0} demande(s) de modification en attente\n`);
      
      if (pendingModRequests && pendingModRequests.length > 0) {
        const now = new Date();
        pendingModRequests.forEach((request, index) => {
          const createdDate = new Date(request.created_at);
          const hoursSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60));
          const isExpired = hoursSinceCreation >= 24;
          
          console.log(`${index + 1}. ${isExpired ? '🔴 EXPIRÉE' : '🟡 EN ATTENTE'} - Demande ${request.id.substring(0, 8)}`);
          console.log(`   Réservation ID: ${request.booking_id.substring(0, 8)}`);
          console.log(`   Guest ID: ${request.guest_id.substring(0, 8)}`);
          console.log(`   Host ID: ${request.host_id.substring(0, 8)}`);
          console.log(`   Nouvelles dates: ${request.requested_check_in} → ${request.requested_check_out}`);
          console.log(`   Nouveau montant: ${request.requested_total_price?.toLocaleString('fr-FR')} FCFA`);
          console.log(`   Message: ${request.guest_message || 'Aucun message'}`);
          console.log(`   Créée le: ${createdDate.toLocaleString('fr-FR')}`);
          console.log(`   ${isExpired ? `⚠️  Créée il y a ${hoursSinceCreation}h (> 24h - DEVRAIT ÊTRE ANNULÉE)` : `Créée il y a ${hoursSinceCreation}h (< 24h)`}`);
          console.log('');
        });
      } else {
        console.log('✅ Aucune demande de modification de propriété en attente\n');
      }
    }

    // 4. Demandes de modification de réservation (véhicules)
    console.log('\n📋 4. DEMANDES DE MODIFICATION DE RÉSERVATION (VÉHICULES)');
    console.log('='.repeat(60));
    const { data: pendingVehicleModRequests, error: vehicleModRequestsError } = await supabase
      .from('vehicle_booking_modification_requests')
      .select(`
        id,
        booking_id,
        renter_id,
        owner_id,
        requested_start_date,
        requested_end_date,
        requested_total_price,
        status,
        created_at,
        booking:vehicle_bookings (
          vehicle:vehicles (
            title
          )
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (vehicleModRequestsError) {
      console.error('❌ Erreur:', vehicleModRequestsError);
    } else {
      console.log(`📊 Total: ${pendingVehicleModRequests?.length || 0} demande(s) de modification de véhicule en attente\n`);
      
      if (pendingVehicleModRequests && pendingVehicleModRequests.length > 0) {
        const now = new Date();
        pendingVehicleModRequests.forEach((request, index) => {
          const createdDate = new Date(request.created_at);
          const hoursSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60));
          const isExpired = hoursSinceCreation >= 24;
          
          console.log(`${index + 1}. ${isExpired ? '🔴 EXPIRÉE' : '🟡 EN ATTENTE'} - Demande ${request.id.substring(0, 8)}`);
          console.log(`   Réservation: ${request.booking_id.substring(0, 8)}`);
          console.log(`   Véhicule: ${request.booking?.vehicle?.title || 'N/A'}`);
          console.log(`   Nouvelles dates: ${request.requested_start_date} → ${request.requested_end_date}`);
          console.log(`   Nouveau montant: ${request.requested_total_price?.toLocaleString('fr-FR')} FCFA`);
          console.log(`   Créée le: ${createdDate.toLocaleString('fr-FR')}`);
          console.log(`   ${isExpired ? `⚠️  Créée il y a ${hoursSinceCreation}h (> 24h - DEVRAIT ÊTRE ANNULÉE)` : `Créée il y a ${hoursSinceCreation}h (< 24h)`}`);
          console.log('');
        });
      } else {
        console.log('✅ Aucune demande de modification de véhicule en attente\n');
      }
    }

    // Résumé
    console.log('\n📊 RÉSUMÉ');
    console.log('='.repeat(60));
    const totalPending = (pendingBookings?.length || 0) + 
                         (pendingVehicleBookings?.length || 0) + 
                         (pendingModRequests?.length || 0) + 
                         (pendingVehicleModRequests?.length || 0);
    
    const now = new Date();
    let totalExpired = 0;
    
    if (pendingBookings) {
      pendingBookings.forEach(b => {
        const hours = Math.floor((now.getTime() - new Date(b.created_at).getTime()) / (1000 * 60 * 60));
        if (hours >= 24) totalExpired++;
      });
    }
    
    if (pendingVehicleBookings) {
      pendingVehicleBookings.forEach(b => {
        const hours = Math.floor((now.getTime() - new Date(b.created_at).getTime()) / (1000 * 60 * 60));
        if (hours >= 24) totalExpired++;
      });
    }
    
    if (pendingModRequests) {
      pendingModRequests.forEach(r => {
        const hours = Math.floor((now.getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60));
        if (hours >= 24) totalExpired++;
      });
    }
    
    if (pendingVehicleModRequests) {
      pendingVehicleModRequests.forEach(r => {
        const hours = Math.floor((now.getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60));
        if (hours >= 24) totalExpired++;
      });
    }
    
    console.log(`Total en attente: ${totalPending}`);
    console.log(`⚠️  Expirées (> 24h): ${totalExpired}`);
    console.log(`✅ Valides (< 24h): ${totalPending - totalExpired}`);
    
    if (totalExpired > 0) {
      console.log(`\n⚠️  ATTENTION: ${totalExpired} élément(s) devraient être annulés automatiquement par le cron job.`);
      console.log('   Vérifiez que le cron job expire-pending-requests est actif dans Supabase Dashboard.');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  }
}

checkPendingItems();

