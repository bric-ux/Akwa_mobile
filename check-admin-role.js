const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://qjqjqjqjqjqjqjqjqjqj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqcWpxanFqcWpxanFqcWpxanFqcWoiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY5OTk5OTk5OSwiZXhwIjoyMDE1NTc1OTk5fQ.example';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdminRole() {
  try {
    console.log('🔍 Vérification du rôle admin pour jeanbrice270@gmail.com...\n');

    // 1. Vérifier si l'utilisateur existe dans auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserByEmail('jeanbrice270@gmail.com');
    
    if (authError) {
      console.error('❌ Erreur lors de la récupération de l\'utilisateur auth:', authError);
      return;
    }

    if (!authUser.user) {
      console.log('❌ Utilisateur jeanbrice270@gmail.com non trouvé dans auth.users');
      return;
    }

    console.log('✅ Utilisateur trouvé dans auth.users:');
    console.log('   - ID:', authUser.user.id);
    console.log('   - Email:', authUser.user.email);
    console.log('   - Créé le:', authUser.user.created_at);

    // 2. Vérifier le profil dans la table profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', authUser.user.id)
      .single();

    if (profileError) {
      console.error('❌ Erreur lors de la récupération du profil:', profileError);
      return;
    }

    if (!profile) {
      console.log('❌ Profil non trouvé dans la table profiles');
      return;
    }

    console.log('\n✅ Profil trouvé dans la table profiles:');
    console.log('   - Nom:', profile.first_name, profile.last_name);
    console.log('   - Email:', profile.email);
    console.log('   - Rôle:', profile.role);
    console.log('   - Est hôte:', profile.is_host);
    console.log('   - Créé le:', profile.created_at);

    // 3. Vérifier si le rôle est admin
    if (profile.role === 'admin') {
      console.log('\n🎉 SUCCÈS: L\'utilisateur jeanbrice270@gmail.com a bien le rôle admin !');
    } else {
      console.log('\n⚠️  ATTENTION: L\'utilisateur jeanbrice270@gmail.com n\'a PAS le rôle admin');
      console.log('   Rôle actuel:', profile.role);
      
      // Proposer de mettre à jour le rôle
      console.log('\n🔧 Voulez-vous mettre à jour le rôle vers admin ? (décommentez la ligne suivante)');
      console.log('   // await updateUserRole(authUser.user.id, "admin");');
    }

    // 4. Vérifier les autres utilisateurs avec le rôle admin
    console.log('\n🔍 Vérification des autres utilisateurs admin...');
    const { data: adminUsers, error: adminError } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, email, role, created_at')
      .eq('role', 'admin');

    if (adminError) {
      console.error('❌ Erreur lors de la récupération des admins:', adminError);
      return;
    }

    console.log(`\n📊 Nombre total d'utilisateurs admin: ${adminUsers.length}`);
    adminUsers.forEach((admin, index) => {
      console.log(`   ${index + 1}. ${admin.first_name} ${admin.last_name} (${admin.email})`);
    });

  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
  }
}

async function updateUserRole(userId, newRole) {
  try {
    console.log(`\n🔧 Mise à jour du rôle vers "${newRole}" pour l'utilisateur ${userId}...`);
    
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Erreur lors de la mise à jour:', error);
      return;
    }

    console.log('✅ Rôle mis à jour avec succès !');
  } catch (error) {
    console.error('❌ Erreur inattendue lors de la mise à jour:', error);
  }
}

// Exécuter la vérification
checkAdminRole();

