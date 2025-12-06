const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ EXPO_PUBLIC_SUPABASE_ANON_KEY non trouvée dans les variables d\'environnement');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEmailVerification() {
  console.log('🔍 Diagnostic de l\'envoi d\'email de vérification\n');
  console.log('='.repeat(60));

  // Test 1: Vérifier que la fonction generate-verification-code existe
  console.log('\n📋 Test 1: Vérification de la fonction generate-verification-code');
  try {
    const testEmail = 'test@example.com';
    const testFirstName = 'Test';
    
    console.log(`   → Appel de la fonction avec email: ${testEmail}`);
    
    const { data, error } = await supabase.functions.invoke('generate-verification-code', {
      body: {
        email: testEmail,
        firstName: testFirstName
      }
    });

    if (error) {
      console.error('   ❌ Erreur lors de l\'appel de la fonction:');
      console.error('      Code:', error.status);
      console.error('      Message:', error.message);
      console.error('      Détails:', JSON.stringify(error, null, 2));
      
      if (error.message?.includes('Function not found') || error.status === 404) {
        console.log('\n   💡 Solution: La fonction Edge n\'est pas déployée');
        console.log('      → Exécutez: cd ../cote-d-ivoire-stays && supabase functions deploy generate-verification-code');
      } else if (error.message?.includes('RESEND_API_KEY')) {
        console.log('\n   💡 Solution: Variable d\'environnement RESEND_API_KEY manquante');
        console.log('      → Ajoutez RESEND_API_KEY dans Supabase Dashboard > Settings > Edge Functions > Secrets');
      } else if (error.message?.includes('Invalid API key') || error.message?.includes('Unauthorized')) {
        console.log('\n   💡 Solution: Clé API Resend invalide ou expirée');
        console.log('      → Vérifiez votre clé API Resend sur https://resend.com/api-keys');
        console.log('      → Mettez à jour RESEND_API_KEY dans Supabase Dashboard');
      }
      
      return;
    }

    console.log('   ✅ Fonction appelée avec succès');
    console.log('   📧 Réponse:', JSON.stringify(data, null, 2));

    // Test 2: Vérifier si le code a été inséré dans la base de données
    console.log('\n📋 Test 2: Vérification du code dans la base de données');
    try {
      const { data: codes, error: dbError } = await supabase
        .from('email_verification_codes')
        .select('*')
        .eq('email', testEmail)
        .order('created_at', { ascending: false })
        .limit(1);

      if (dbError) {
        console.error('   ❌ Erreur lors de la récupération du code:', dbError);
      } else if (codes && codes.length > 0) {
        console.log('   ✅ Code trouvé dans la base de données:');
        console.log('      Code:', codes[0].code);
        console.log('      Expire à:', codes[0].expires_at);
        console.log('      Utilisé:', codes[0].used);
      } else {
        console.log('   ⚠️  Aucun code trouvé dans la base de données');
      }
    } catch (err) {
      console.error('   ❌ Erreur:', err);
    }

    // Test 3: Vérifier les logs de la fonction send-email
    console.log('\n📋 Test 3: Test direct de la fonction send-email');
    try {
      const { data: emailData, error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'email_confirmation',
          to: testEmail,
          data: {
            firstName: testFirstName,
            verificationCode: '123456'
          }
        }
      });

      if (emailError) {
        console.error('   ❌ Erreur lors de l\'envoi de l\'email:');
        console.error('      Code:', emailError.status);
        console.error('      Message:', emailError.message);
        console.error('      Détails:', JSON.stringify(emailError, null, 2));
        
        if (emailError.message?.includes('RESEND_API_KEY')) {
          console.log('\n   💡 Solution: Variable d\'environnement RESEND_API_KEY manquante');
          console.log('      → Ajoutez RESEND_API_KEY dans Supabase Dashboard > Settings > Edge Functions > Secrets');
        } else if (emailError.message?.includes('Invalid API key') || emailError.message?.includes('Unauthorized')) {
          console.log('\n   💡 Solution: Clé API Resend invalide');
          console.log('      → Vérifiez votre clé API Resend sur https://resend.com/api-keys');
        } else if (emailError.message?.includes('Domain not verified')) {
          console.log('\n   💡 Solution: Domaine d\'envoi non vérifié dans Resend');
          console.log('      → Vérifiez votre domaine sur https://resend.com/domains');
          console.log('      → Ou utilisez un domaine vérifié au lieu de onboarding@resend.dev');
        }
      } else {
        console.log('   ✅ Email envoyé avec succès');
        console.log('   📧 Réponse:', JSON.stringify(emailData, null, 2));
      }
    } catch (err) {
      console.error('   ❌ Erreur inattendue:', err);
    }

  } catch (err) {
    console.error('❌ Erreur inattendue:', err);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n🔧 Étapes de résolution :');
  console.log('1. Vérifier que les fonctions Edge sont déployées:');
  console.log('   cd ../cote-d-ivoire-stays');
  console.log('   supabase functions deploy generate-verification-code');
  console.log('   supabase functions deploy send-email');
  console.log('\n2. Vérifier les variables d\'environnement dans Supabase:');
  console.log('   → Dashboard > Settings > Edge Functions > Secrets');
  console.log('   → Ajoutez RESEND_API_KEY avec votre clé API Resend');
  console.log('\n3. Vérifier votre compte Resend:');
  console.log('   → https://resend.com/api-keys (pour la clé API)');
  console.log('   → https://resend.com/domains (pour vérifier le domaine)');
  console.log('\n4. Vérifier les logs de la fonction:');
  console.log('   supabase functions logs send-email');
  console.log('   supabase functions logs generate-verification-code');
  console.log('\n5. Tester avec un email valide (pas test@example.com)');
}

testEmailVerification().catch(console.error);

















