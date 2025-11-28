/**
 * Script pour vérifier le statut de vérification d'email en base de données
 * Usage: node check-email-verification-db.js <email>
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes:');
  console.error('   EXPO_PUBLIC_SUPABASE_URL ou SUPABASE_URL');
  console.error('   EXPO_PUBLIC_SUPABASE_ANON_KEY ou SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmailVerification(email) {
  console.log(`\n🔍 Vérification du statut email pour: ${email}\n`);

  try {
    // Récupérer le profil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email, email_verified, created_at, updated_at')
      .eq('email', email)
      .single();

    if (profileError) {
      console.error('❌ Erreur lors de la récupération du profil:', profileError);
      return;
    }

    if (!profile) {
      console.error('❌ Profil non trouvé pour cet email');
      return;
    }

    console.log('📧 Données du profil:');
    console.log('   user_id:', profile.user_id);
    console.log('   email:', profile.email);
    console.log('   email_verified:', profile.email_verified, `(type: ${typeof profile.email_verified})`);
    console.log('   created_at:', profile.created_at);
    console.log('   updated_at:', profile.updated_at);

    // Vérifier les codes de vérification
    const { data: codes, error: codesError } = await supabase
      .from('email_verification_codes')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(5);

    if (codesError) {
      console.error('❌ Erreur lors de la récupération des codes:', codesError);
    } else {
      console.log(`\n📝 Codes de vérification (${codes.length} derniers):`);
      codes.forEach((code, index) => {
        console.log(`   ${index + 1}. Code: ${code.code}, Used: ${code.used}, Expires: ${code.expires_at}`);
      });
    }

    // Résumé
    console.log('\n📊 Résumé:');
    if (profile.email_verified === true) {
      console.log('   ✅ Email vérifié');
    } else {
      console.log('   ⚠️  Email NON vérifié');
      console.log('   💡 Vérifiez les logs de la fonction Edge verify-code dans Supabase Dashboard');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Récupérer l'email depuis les arguments
const email = process.argv[2];

if (!email) {
  console.error('❌ Usage: node check-email-verification-db.js <email>');
  process.exit(1);
}

checkEmailVerification(email);











