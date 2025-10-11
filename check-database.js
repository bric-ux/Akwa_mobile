const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  try {
    console.log('🔍 Vérification de la base de données...\n');

    // 1. Vérifier la table profiles
    console.log('📋 Vérification de la table profiles...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);

    if (profilesError) {
      console.error('❌ Erreur lors de la récupération des profils:', profilesError);
    } else {
      console.log(`✅ Table profiles accessible - ${profiles.length} profil(s) trouvé(s)`);
      if (profiles.length > 0) {
        console.log('📋 Premiers profils:');
        profiles.forEach((profile, index) => {
          console.log(`   ${index + 1}. ${profile.first_name} ${profile.last_name} (${profile.email})`);
          console.log(`      - Rôle: ${profile.role || 'Non défini'}`);
          console.log(`      - Est hôte: ${profile.is_host ? 'Oui' : 'Non'}`);
          console.log(`      - ID: ${profile.user_id}`);
        });
      }
    }

    // 2. Vérifier la table properties
    console.log('\n🏠 Vérification de la table properties...');
    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('id, title, host_id, is_active')
      .limit(5);

    if (propertiesError) {
      console.error('❌ Erreur lors de la récupération des propriétés:', propertiesError);
    } else {
      console.log(`✅ Table properties accessible - ${properties.length} propriété(s) trouvée(s)`);
      if (properties.length > 0) {
        console.log('📋 Premières propriétés:');
        properties.forEach((property, index) => {
          console.log(`   ${index + 1}. ${property.title}`);
          console.log(`      - Hôte ID: ${property.host_id}`);
          console.log(`      - Active: ${property.is_active ? 'Oui' : 'Non'}`);
        });
      }
    }

    // 3. Vérifier la table host_applications
    console.log('\n📝 Vérification de la table host_applications...');
    const { data: applications, error: applicationsError } = await supabase
      .from('host_applications')
      .select('id, full_name, email, status')
      .limit(5);

    if (applicationsError) {
      console.error('❌ Erreur lors de la récupération des candidatures:', applicationsError);
    } else {
      console.log(`✅ Table host_applications accessible - ${applications.length} candidature(s) trouvée(s)`);
      if (applications.length > 0) {
        console.log('📋 Premières candidatures:');
        applications.forEach((app, index) => {
          console.log(`   ${index + 1}. ${app.full_name} (${app.email})`);
          console.log(`      - Statut: ${app.status}`);
        });
      }
    }

    // 4. Vérifier la table bookings
    console.log('\n📅 Vérification de la table bookings...');
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, guest_id, status, total_price')
      .limit(5);

    if (bookingsError) {
      console.error('❌ Erreur lors de la récupération des réservations:', bookingsError);
    } else {
      console.log(`✅ Table bookings accessible - ${bookings.length} réservation(s) trouvée(s)`);
      if (bookings.length > 0) {
        console.log('📋 Premières réservations:');
        bookings.forEach((booking, index) => {
          console.log(`   ${index + 1}. ID: ${booking.id}`);
          console.log(`      - Voyageur ID: ${booking.guest_id}`);
          console.log(`      - Statut: ${booking.status}`);
          console.log(`      - Prix: ${booking.total_price} XOF`);
        });
      }
    }

    // 5. Statistiques générales
    console.log('\n📊 Statistiques générales:');
    
    const { count: profilesCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    const { count: propertiesCount } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true });
    
    const { count: applicationsCount } = await supabase
      .from('host_applications')
      .select('*', { count: 'exact', head: true });
    
    const { count: bookingsCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true });

    console.log(`   - Profils: ${profilesCount || 0}`);
    console.log(`   - Propriétés: ${propertiesCount || 0}`);
    console.log(`   - Candidatures: ${applicationsCount || 0}`);
    console.log(`   - Réservations: ${bookingsCount || 0}`);

    // 6. Vérifier les rôles spécifiquement
    if (profiles && profiles.length > 0) {
      console.log('\n👑 Vérification des rôles:');
      const roleStats = profiles.reduce((acc, profile) => {
        const role = profile.role || 'Non défini';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {});

      Object.entries(roleStats).forEach(([role, count]) => {
        console.log(`   - ${role}: ${count} utilisateur(s)`);
      });

      // Chercher jeanbrice270@gmail.com
      const jeanbrice = profiles.find(p => p.email === 'jeanbrice270@gmail.com');
      if (jeanbrice) {
        console.log('\n🎯 jeanbrice270@gmail.com trouvé:');
        console.log(`   - Nom: ${jeanbrice.first_name} ${jeanbrice.last_name}`);
        console.log(`   - Rôle: ${jeanbrice.role || 'Non défini'}`);
        console.log(`   - Est hôte: ${jeanbrice.is_host ? 'Oui' : 'Non'}`);
        console.log(`   - ID: ${jeanbrice.user_id}`);
      } else {
        console.log('\n❌ jeanbrice270@gmail.com non trouvé dans les profils');
      }
    }

  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
  }
}

// Exécuter la vérification
checkDatabase();

