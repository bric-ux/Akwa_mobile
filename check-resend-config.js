const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testEmailVerification() {
  console.log('🔍 Test de l\'envoi d\'email de vérification\n');
  console.log('='.repeat(60));

  // Utiliser un email de test (remplacez par votre email réel)
  const testEmail = 'brice.kouadio.pro@gmail.com'; // Remplacez par votre email
  const testFirstName = 'Test';

  try {
    console.log(`\n📧 Test avec l'email: ${testEmail}`);
    console.log('   → Appel de generate-verification-code...\n');

    const { data, error } = await supabase.functions.invoke('generate-verification-code', {
      body: {
        email: testEmail,
        firstName: testFirstName
      }
    });

    if (error) {
      console.error('❌ Erreur:', error);
      console.error('\n📋 Détails de l\'erreur:');
      console.error('   Code:', error.status);
      console.error('   Message:', error.message);
      
      if (error.message?.includes('RESEND_API_KEY') || error.message?.includes('Configuration manquante')) {
        console.log('\n💡 SOLUTION:');
        console.log('   1. Allez sur https://resend.com/api-keys');
        console.log('   2. Copiez votre clé API (recommandé: "lovable-production" avec Full access)');
        console.log('   3. Dans Supabase Dashboard:');
        console.log('      → Settings > Edge Functions > Secrets');
        console.log('      → Ajoutez: RESEND_API_KEY = votre_clé_api');
        console.log('   4. Redéployez les fonctions:');
        console.log('      cd ../cote-d-ivoire-stays');
        console.log('      supabase functions deploy send-email');
        console.log('      supabase functions deploy generate-verification-code');
      } else if (error.message?.includes('Invalid API key') || error.message?.includes('Unauthorized')) {
        console.log('\n💡 SOLUTION:');
        console.log('   La clé API Resend est invalide ou expirée.');
        console.log('   1. Vérifiez votre clé sur https://resend.com/api-keys');
        console.log('   2. Utilisez la clé "lovable-production" (Full access)');
        console.log('   3. Mettez à jour RESEND_API_KEY dans Supabase Dashboard');
      } else if (error.message?.includes('Domain')) {
        console.log('\n💡 SOLUTION:');
        console.log('   Problème de domaine. Vérifiez vos domaines sur https://resend.com/domains');
      }
      
      return;
    }

    if (data?.error) {
      console.error('❌ Erreur dans la réponse:', data.error);
      if (data.details) {
        console.error('   Détails:', JSON.stringify(data.details, null, 2));
      }
      return;
    }

    console.log('✅ Succès!');
    console.log('📧 Réponse:', JSON.stringify(data, null, 2));
    console.log('\n📬 Vérifiez votre boîte email (et le dossier spam) pour le code de vérification.');

    // Vérifier si le code a été créé dans la base de données
    console.log('\n🔍 Vérification du code dans la base de données...');
    const { data: codes, error: dbError } = await supabase
      .from('email_verification_codes')
      .select('*')
      .eq('email', testEmail)
      .order('created_at', { ascending: false })
      .limit(1);

    if (dbError) {
      console.error('   ⚠️  Erreur DB:', dbError.message);
    } else if (codes && codes.length > 0) {
      console.log('   ✅ Code trouvé dans la DB:');
      console.log('      Code:', codes[0].code);
      console.log('      Expire à:', new Date(codes[0].expires_at).toLocaleString('fr-FR'));
    } else {
      console.log('   ⚠️  Aucun code trouvé dans la DB');
    }

  } catch (err) {
    console.error('❌ Erreur inattendue:', err);
  }

  console.log('\n' + '='.repeat(60));
}

testEmailVerification().catch(console.error);

















