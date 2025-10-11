const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase (même que dans l'app mobile)
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testEmailFunction() {
  console.log('📧 Test de la fonction Edge send-email...\n');

  try {
    console.log('🔍 Test 1: Vérification de l\'existence de la fonction...');
    
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'welcome',
        to: 'test@example.com',
        data: {
          firstName: 'Test User'
        }
      }
    });

    if (error) {
      console.error('❌ Erreur lors de l\'appel de la fonction:');
      console.error('Code:', error.status);
      console.error('Message:', error.message);
      console.error('Détails:', error);
      
      if (error.message.includes('Function not found')) {
        console.log('\n💡 Solution: La fonction Edge n\'est pas déployée');
        console.log('   → Exécutez: cd cote-d-ivoire-stays && ./deploy-functions.sh');
      } else if (error.message.includes('Invalid API key')) {
        console.log('\n💡 Solution: Clé API incorrecte');
        console.log('   → Vérifiez les variables d\'environnement');
      } else if (error.message.includes('RESEND_API_KEY')) {
        console.log('\n💡 Solution: Variable d\'environnement manquante');
        console.log('   → Ajoutez RESEND_API_KEY dans Supabase Dashboard');
      } else {
        console.log('\n💡 Solution: Erreur de configuration');
        console.log('   → Vérifiez les logs de la fonction Edge');
      }
    } else {
      console.log('✅ Fonction Edge accessible');
      console.log('📧 Réponse:', data);
    }

  } catch (err) {
    console.error('❌ Erreur inattendue:', err);
  }

  console.log('\n🔧 Étapes de diagnostic :');
  console.log('1. Vérifier que la fonction est déployée');
  console.log('2. Vérifier les variables d\'environnement dans Supabase');
  console.log('3. Vérifier les logs de la fonction Edge');
  console.log('4. Tester avec un email valide');
}

testEmailFunction();
