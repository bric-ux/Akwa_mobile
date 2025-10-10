const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdminUsers() {
  try {
    console.log('🔍 Vérification des utilisateurs avec le rôle admin...\n');

    // 1. Récupérer tous les utilisateurs avec le rôle admin
    const { data: adminUsers, error: adminError } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, email, role, is_host, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: false });

    if (adminError) {
      console.error('❌ Erreur lors de la récupération des admins:', adminError);
      return;
    }

    console.log(`📊 Nombre total d'utilisateurs admin: ${adminUsers.length}\n`);

    if (adminUsers.length === 0) {
      console.log('⚠️  Aucun utilisateur n\'a le rôle admin !');
      
      // Vérifier tous les utilisateurs pour voir leurs rôles
      console.log('\n🔍 Vérification de tous les utilisateurs...');
      const { data: allUsers, error: allUsersError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, role, is_host, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (allUsersError) {
        console.error('❌ Erreur lors de la récupération des utilisateurs:', allUsersError);
        return;
      }

      console.log(`\n📋 Derniers utilisateurs créés (${allUsers.length}):`);
      allUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.first_name} ${user.last_name} (${user.email})`);
        console.log(`      - Rôle: ${user.role || 'Non défini'}`);
        console.log(`      - Est hôte: ${user.is_host ? 'Oui' : 'Non'}`);
        console.log(`      - Créé le: ${user.created_at}`);
        console.log('');
      });

      return;
    }

    // Afficher les utilisateurs admin
    adminUsers.forEach((admin, index) => {
      console.log(`👑 Admin ${index + 1}:`);
      console.log(`   - Nom: ${admin.first_name} ${admin.last_name}`);
      console.log(`   - Email: ${admin.email}`);
      console.log(`   - ID: ${admin.user_id}`);
      console.log(`   - Est hôte: ${admin.is_host ? 'Oui' : 'Non'}`);
      console.log(`   - Créé le: ${admin.created_at}`);
      console.log('');
    });

    // 2. Vérifier spécifiquement jeanbrice270@gmail.com
    console.log('🔍 Vérification spécifique de jeanbrice270@gmail.com...');
    const jeanbrice = adminUsers.find(user => user.email === 'jeanbrice270@gmail.com');
    
    if (jeanbrice) {
      console.log('✅ jeanbrice270@gmail.com a bien le rôle admin !');
      console.log(`   - Nom: ${jeanbrice.first_name} ${jeanbrice.last_name}`);
      console.log(`   - ID: ${jeanbrice.user_id}`);
    } else {
      console.log('❌ jeanbrice270@gmail.com n\'a PAS le rôle admin');
      
      // Chercher cet utilisateur dans tous les utilisateurs
      const { data: jeanbriceUser, error: jeanbriceError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, role, is_host, created_at')
        .eq('email', 'jeanbrice270@gmail.com')
        .single();

      if (jeanbriceError) {
        console.log('❌ Utilisateur jeanbrice270@gmail.com non trouvé dans la base');
      } else {
        console.log('📋 Utilisateur trouvé mais avec un autre rôle:');
        console.log(`   - Nom: ${jeanbriceUser.first_name} ${jeanbriceUser.last_name}`);
        console.log(`   - Rôle actuel: ${jeanbriceUser.role || 'Non défini'}`);
        console.log(`   - Est hôte: ${jeanbriceUser.is_host ? 'Oui' : 'Non'}`);
      }
    }

    // 3. Statistiques générales
    console.log('\n📊 Statistiques générales:');
    const { data: allUsers, error: allUsersError } = await supabase
      .from('profiles')
      .select('role, is_host')
      .not('role', 'is', null);

    if (!allUsersError && allUsers) {
      const roleStats = allUsers.reduce((acc, user) => {
        const role = user.role || 'Non défini';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {});

      const hostStats = allUsers.filter(user => user.is_host).length;

      console.log('   - Répartition des rôles:');
      Object.entries(roleStats).forEach(([role, count]) => {
        console.log(`     * ${role}: ${count} utilisateur(s)`);
      });
      console.log(`   - Nombre d'hôtes: ${hostStats}`);
    }

  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
  }
}

// Exécuter la vérification
checkAdminUsers();
