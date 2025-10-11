const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUsersManagement() {
  try {
    console.log('🔍 Test de la gestion des utilisateurs...\n');

    // 1. Vérifier la table profiles
    console.log('👥 Test de la table profiles...');
    
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (usersError) {
      console.error('❌ Erreur lors de la récupération des utilisateurs:', usersError);
      return;
    }

    console.log(`✅ Table profiles accessible - ${users.length} utilisateur(s) trouvé(s)`);
    
    if (users.length > 0) {
      console.log('\n👤 Détails des utilisateurs:');
      users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.first_name} ${user.last_name}`);
        console.log(`      - Email: ${user.email}`);
        console.log(`      - Rôle: ${user.role}`);
        console.log(`      - Hôte: ${user.is_host ? 'Oui' : 'Non'}`);
        console.log(`      - Téléphone: ${user.phone || 'Non renseigné'}`);
        console.log(`      - Date d'inscription: ${new Date(user.created_at).toLocaleDateString('fr-FR')}`);
        console.log('');
      });
    }

    // 2. Statistiques par rôle
    console.log('📊 Statistiques par rôle...');
    
    const roleCounts = {
      admin: 0,
      host: 0,
      user: 0
    };

    users.forEach(user => {
      if (user.role === 'admin') {
        roleCounts.admin++;
      } else if (user.is_host) {
        roleCounts.host++;
      } else {
        roleCounts.user++;
      }
    });

    console.log('   - Administrateurs:', roleCounts.admin);
    console.log('   - Hôtes:', roleCounts.host);
    console.log('   - Utilisateurs:', roleCounts.user);

    // 3. Vérifier les utilisateurs récents
    console.log('\n🕒 Utilisateurs récents (7 derniers jours)...');
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentUsers = users.filter(user => 
      new Date(user.created_at) >= sevenDaysAgo
    );

    console.log(`   - Nouveaux utilisateurs: ${recentUsers.length}`);
    
    if (recentUsers.length > 0) {
      recentUsers.forEach((user, index) => {
        console.log(`     ${index + 1}. ${user.first_name} ${user.last_name} (${user.email})`);
      });
    }

    // 4. Vérifier les hôtes actifs
    console.log('\n🏠 Hôtes actifs...');
    
    const hosts = users.filter(user => user.is_host && user.role !== 'admin');
    console.log(`   - Nombre d'hôtes: ${hosts.length}`);
    
    if (hosts.length > 0) {
      hosts.forEach((host, index) => {
        console.log(`     ${index + 1}. ${host.first_name} ${host.last_name} (${host.email})`);
      });
    }

    // 5. Vérifier les administrateurs
    console.log('\n🛡️ Administrateurs...');
    
    const admins = users.filter(user => user.role === 'admin');
    console.log(`   - Nombre d'admins: ${admins.length}`);
    
    if (admins.length > 0) {
      admins.forEach((admin, index) => {
        console.log(`     ${index + 1}. ${admin.first_name} ${admin.last_name} (${admin.email})`);
      });
    }

    // 6. Test de recherche par email
    console.log('\n🔍 Test de recherche...');
    
    if (users.length > 0) {
      const testEmail = users[0].email;
      const searchResults = users.filter(user => 
        user.email.toLowerCase().includes(testEmail.toLowerCase())
      );
      
      console.log(`   - Recherche par email "${testEmail}": ${searchResults.length} résultat(s)`);
    }

    // 7. Vérifier les permissions RLS
    console.log('\n🔒 Test des permissions RLS...');
    
    // Test de lecture anonyme (devrait échouer)
    const { data: anonymousData, error: anonymousError } = await supabase
      .from('profiles')
      .select('user_id')
      .limit(1);

    if (anonymousError) {
      console.log('✅ RLS fonctionne - Accès anonyme refusé');
    } else {
      console.log('⚠️  RLS pourrait ne pas être configuré correctement');
    }

    // 8. Statistiques générales
    console.log('\n📈 Statistiques générales:');
    console.log(`   - Total des utilisateurs: ${users.length}`);
    console.log(`   - Utilisateurs avec téléphone: ${users.filter(u => u.phone).length}`);
    console.log(`   - Utilisateurs avec avatar: ${users.filter(u => u.avatar_url).length}`);
    console.log(`   - Utilisateurs vérifiés: ${users.filter(u => u.email_confirmed_at).length}`);

    console.log('\n✅ Test de la gestion des utilisateurs terminé avec succès !');

  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
  }
}

// Exécuter le test
testUsersManagement();

