// Script de test pour vérifier le statut email_verified dans la base de données
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEmailVerificationStatus() {
  console.log('🔍 Test du statut de vérification d\'email\n');

  // Remplacer par votre email
  const testEmail = 'kouadioemma061@gmail.com';

  try {
    // 1. Récupérer le profil par email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email, email_verified')
      .eq('email', testEmail)
      .single();

    if (profileError) {
      console.error('❌ Erreur lors de la récupération du profil:', profileError);
      return;
    }

    if (!profile) {
      console.log('❌ Profil non trouvé pour l\'email:', testEmail);
      return;
    }

    console.log('✅ Profil trouvé:');
    console.log('   - user_id:', profile.user_id);
    console.log('   - email:', profile.email);
    console.log('   - email_verified:', profile.email_verified);
    console.log('   - type de email_verified:', typeof profile.email_verified);

    // 2. Vérifier aussi avec user_id
    const { data: profileById, error: profileByIdError } = await supabase
      .from('profiles')
      .select('user_id, email, email_verified')
      .eq('user_id', profile.user_id)
      .single();

    if (profileByIdError) {
      console.error('❌ Erreur lors de la récupération par user_id:', profileByIdError);
    } else {
      console.log('\n✅ Profil récupéré par user_id:');
      console.log('   - email_verified:', profileById.email_verified);
      console.log('   - type:', typeof profileById.email_verified);
    }

    // 3. Vérifier les codes de vérification utilisés
    const { data: codes, error: codesError } = await supabase
      .from('email_verification_codes')
      .select('*')
      .eq('email', testEmail)
      .eq('used', true)
      .order('created_at', { ascending: false })
      .limit(5);

    if (codesError) {
      console.error('❌ Erreur lors de la récupération des codes:', codesError);
    } else {
      console.log('\n📧 Codes de vérification utilisés:', codes?.length || 0);
      if (codes && codes.length > 0) {
        console.log('   Dernier code utilisé le:', codes[0].created_at);
      }
    }

    // 4. Conclusion
    console.log('\n📊 Conclusion:');
    if (profile.email_verified === true) {
      console.log('✅ email_verified est TRUE - L\'email est vérifié en base');
      console.log('⚠️ Si l\'app mobile affiche "non vérifié", le problème est dans la récupération côté mobile');
    } else if (profile.email_verified === false) {
      console.log('❌ email_verified est FALSE - L\'email n\'est PAS vérifié en base');
      console.log('⚠️ Il faut vérifier l\'email à nouveau');
    } else if (profile.email_verified === null) {
      console.log('⚠️ email_verified est NULL - Valeur non définie');
      console.log('⚠️ Il faut mettre à jour le profil pour définir la valeur');
    } else {
      console.log('⚠️ email_verified a une valeur inattendue:', profile.email_verified);
    }

  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
  }
}

// Exécuter le test
testEmailVerificationStatus();

