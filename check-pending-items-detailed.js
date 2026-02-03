const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPendingItemsDetailed() {
  try {
    console.log('🔍 Vérification détaillée des demandes en attente...\n');

    // Vérifier toutes les demandes de modification (sans filtre de statut d'abord)
    console.log('📋 TOUTES LES DEMANDES DE MODIFICATION (tous statuts)');
    console.log('='.repeat(60));
    const { data: allModRequests, error: allModError } = await supabase
      .from('booking_modification_requests')
      .select('id, booking_id, guest_id, host_id, status, created_at, requested_check_in, requested_check_out')
      .order('created_at', { ascending: false })
      .limit(50);

    if (allModError) {
      console.error('❌ Erreur lors de la récupération:', allModError);
      console.error('   Code:', allModError.code);
      console.error('   Message:', allModError.message);
      console.error('   Détails:', allModError.details);
    } else {
      console.log(`📊 Total trouvé: ${allModRequests?.length || 0} demande(s) de modification (tous statuts)\n`);
      
      if (allModRequests && allModRequests.length > 0) {
        const pending = allModRequests.filter(r => r.status === 'pending');
        const approved = allModRequests.filter(r => r.status === 'approved');
        const rejected = allModRequests.filter(r => r.status === 'rejected');
        const cancelled = allModRequests.filter(r => r.status === 'cancelled');
        
        console.log(`   🟡 En attente (pending): ${pending.length}`);
        console.log(`   ✅ Approuvées (approved): ${approved.length}`);
        console.log(`   ❌ Rejetées (rejected): ${rejected.length}`);
        console.log(`   🚫 Annulées (cancelled): ${cancelled.length}\n`);
        
        if (pending.length > 0) {
          console.log('📋 DÉTAILS DES DEMANDES EN ATTENTE:');
          const now = new Date();
          pending.forEach((request, index) => {
            const createdDate = new Date(request.created_at);
            const hoursSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60));
            const isExpired = hoursSinceCreation >= 24;
            
            console.log(`\n${index + 1}. ${isExpired ? '🔴 EXPIRÉE' : '🟡 EN ATTENTE'} - Demande ${request.id.substring(0, 8)}`);
            console.log(`   Réservation ID: ${request.booking_id.substring(0, 8)}`);
            console.log(`   Guest ID: ${request.guest_id.substring(0, 8)}`);
            console.log(`   Host ID: ${request.host_id.substring(0, 8)}`);
            console.log(`   Nouvelles dates: ${request.requested_check_in} → ${request.requested_check_out}`);
            console.log(`   Créée le: ${createdDate.toLocaleString('fr-FR')}`);
            console.log(`   ${isExpired ? `⚠️  Créée il y a ${hoursSinceCreation}h (> 24h - DEVRAIT ÊTRE ANNULÉE)` : `Créée il y a ${hoursSinceCreation}h (< 24h)`}`);
          });
        }
        
        // Afficher les 5 plus récentes (tous statuts)
        console.log('\n📋 5 DERNIÈRES DEMANDES (tous statuts):');
        allModRequests.slice(0, 5).forEach((request, index) => {
          const createdDate = new Date(request.created_at);
          const statusEmoji = {
            'pending': '🟡',
            'approved': '✅',
            'rejected': '❌',
            'cancelled': '🚫'
          }[request.status] || '❓';
          
          console.log(`${index + 1}. ${statusEmoji} ${request.status.toUpperCase()} - ${request.id.substring(0, 8)}`);
          console.log(`   Créée le: ${createdDate.toLocaleString('fr-FR')}`);
          console.log(`   Dates: ${request.requested_check_in} → ${request.requested_check_out}`);
        });
      } else {
        console.log('⚠️  Aucune demande de modification trouvée dans la base de données.\n');
        console.log('   Cela peut être dû à:');
        console.log('   1. Aucune demande n\'a été créée');
        console.log('   2. Les politiques RLS empêchent la lecture (nécessite authentification)');
        console.log('   3. La table est vide');
      }
    }

    // Vérifier aussi les réservations en attente
    console.log('\n\n📋 TOUTES LES RÉSERVATIONS (tous statuts récents)');
    console.log('='.repeat(60));
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: recentBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, property_id, check_in_date, check_out_date, status, created_at')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (bookingsError) {
      console.error('❌ Erreur:', bookingsError);
    } else {
      console.log(`📊 Total trouvé: ${recentBookings?.length || 0} réservation(s) récente(s)\n`);
      
      if (recentBookings && recentBookings.length > 0) {
        const pending = recentBookings.filter(b => b.status === 'pending');
        const confirmed = recentBookings.filter(b => b.status === 'confirmed');
        const cancelled = recentBookings.filter(b => b.status === 'cancelled');
        
        console.log(`   🟡 En attente (pending): ${pending.length}`);
        console.log(`   ✅ Confirmées (confirmed): ${confirmed.length}`);
        console.log(`   🚫 Annulées (cancelled): ${cancelled.length}\n`);
        
        if (pending.length > 0) {
          console.log('📋 DÉTAILS DES RÉSERVATIONS EN ATTENTE:');
          pending.forEach((booking, index) => {
            const createdDate = new Date(booking.created_at);
            console.log(`\n${index + 1}. Réservation ${booking.id.substring(0, 8)}`);
            console.log(`   Dates: ${booking.check_in_date} → ${booking.check_out_date}`);
            console.log(`   Créée le: ${createdDate.toLocaleString('fr-FR')}`);
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  }
}

checkPendingItemsDetailed();











