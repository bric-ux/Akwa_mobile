const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyEmailSent() {
  console.log('🔍 Vérification de l\'envoi d\'email\n');
  console.log('='.repeat(60));

  const email = 'kouadioemma01@gmail.com';

  try {
    // Vérifier les codes de vérification récents pour cet email
    console.log(`\n📋 Recherche des codes de vérification pour: ${email}`);
    
    const { data: codes, error: dbError } = await supabase
      .from('email_verification_codes')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(5);

    if (dbError) {
      console.error('❌ Erreur lors de la récupération des codes:', dbError);
      return;
    }

    if (!codes || codes.length === 0) {
      console.log('⚠️  Aucun code de vérification trouvé dans la base de données');
      console.log('   → Cela signifie que le code n\'a pas été créé en base');
      console.log('   → Vérifiez les logs de la fonction generate-verification-code');
      return;
    }

    console.log(`\n✅ ${codes.length} code(s) trouvé(s) dans la base de données:\n`);

    codes.forEach((code, index) => {
      const createdAt = new Date(code.created_at);
      const expiresAt = new Date(code.expires_at);
      const now = new Date();
      const isExpired = expiresAt < now;
      const isUsed = code.used;

      console.log(`📧 Code #${index + 1}:`);
      console.log(`   Code: ${code.code}`);
      console.log(`   Créé: ${createdAt.toLocaleString('fr-FR')}`);
      console.log(`   Expire: ${expiresAt.toLocaleString('fr-FR')}`);
      console.log(`   Statut: ${isUsed ? '❌ Utilisé' : isExpired ? '⏰ Expiré' : '✅ Valide'}`);
      console.log('');
    });

    // Vérifier le dernier code
    const lastCode = codes[0];
    const expiresAt = new Date(lastCode.expires_at);
    const now = new Date();
    const isExpired = expiresAt < now;

    console.log('📊 Résumé:');
    console.log(`   Dernier code: ${lastCode.code}`);
    console.log(`   Créé: ${new Date(lastCode.created_at).toLocaleString('fr-FR')}`);
    console.log(`   Expire: ${expiresAt.toLocaleString('fr-FR')}`);
    console.log(`   Utilisé: ${lastCode.used ? 'Oui' : 'Non'}`);
    console.log(`   Valide: ${!lastCode.used && !isExpired ? 'Oui' : 'Non'}`);

    if (!lastCode.used && !isExpired) {
      console.log('\n✅ Le code est valide et n\'a pas été utilisé');
      console.log('   → Si vous n\'avez pas reçu l\'email, vérifiez:');
      console.log('      1. Le dossier spam/courrier indésirable');
      console.log('      2. Les logs Resend sur https://resend.com/emails');
      console.log('      3. Les logs Supabase Edge Functions');
    } else if (lastCode.used) {
      console.log('\n⚠️  Le dernier code a déjà été utilisé');
      console.log('   → Générez un nouveau code si nécessaire');
    } else if (isExpired) {
      console.log('\n⏰ Le dernier code a expiré');
      console.log('   → Générez un nouveau code');
    }

    // Test d'envoi direct
    console.log('\n' + '='.repeat(60));
    console.log('\n🧪 Test d\'envoi d\'email direct...\n');
    
    const { data: testData, error: testError } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'email_confirmation',
        to: email,
        data: {
          firstName: 'Test',
          verificationCode: '123456'
        }
      }
    });

    if (testError) {
      console.error('❌ Erreur lors du test d\'envoi:', testError);
      console.error('   Message:', testError.message);
      console.error('   Détails:', JSON.stringify(testError, null, 2));
    } else if (testData && testData.error) {
      console.error('❌ Erreur dans la réponse:', testData.error);
      if (testData.details) {
        console.error('   Détails:', JSON.stringify(testData.details, null, 2));
      }
    } else {
      console.log('✅ Test d\'envoi réussi');
      console.log('   Réponse:', JSON.stringify(testData, null, 2));
      console.log('\n   → Vérifiez votre boîte email (et le dossier spam)');
      console.log('   → Vérifiez les logs Resend sur https://resend.com/emails');
    }

  } catch (err) {
    console.error('❌ Erreur inattendue:', err);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n💡 Prochaines étapes:');
  console.log('1. Vérifiez votre boîte email (y compris les spams)');
  console.log('2. Vérifiez les logs Resend: https://resend.com/emails');
  console.log('3. Vérifiez les logs Supabase:');
  console.log('   cd ../cote-d-ivoire-stays');
  console.log('   supabase functions logs send-email --tail');
  console.log('   supabase functions logs generate-verification-code --tail');
}

verifyEmailSent().catch(console.error);







