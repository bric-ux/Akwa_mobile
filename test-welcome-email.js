const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://your-project.supabase.co'; // Remplacez par votre URL
const supabaseKey = 'your-anon-key'; // Remplacez par votre clé

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWelcomeEmail() {
  console.log('📧 Test de l\'envoi d\'email de bienvenue...\n');

  try {
    // Test 1: Vérifier si la fonction Edge existe
    console.log('🔍 Test 1: Vérification de la fonction Edge...');
    
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'welcome',
        to: 'test@example.com',
        data: {
          firstName: 'Test'
        }
      }
    });

    if (error) {
      console.error('❌ Erreur fonction Edge:', error);
      
      if (error.message.includes('Function not found')) {
        console.log('💡 Solution: La fonction Edge "send-email" n\'existe pas');
        console.log('   → Déployez la fonction depuis le projet web');
      } else if (error.message.includes('Invalid API key')) {
        console.log('💡 Solution: Clé API Supabase incorrecte');
        console.log('   → Vérifiez SUPABASE_URL et SUPABASE_ANON_KEY');
      } else {
        console.log('💡 Solution: Erreur de configuration');
        console.log('   → Vérifiez la configuration Supabase');
      }
    } else {
      console.log('✅ Fonction Edge accessible');
      console.log('📧 Réponse:', data);
    }

  } catch (err) {
    console.error('❌ Erreur inattendue:', err);
  }

  console.log('\n🔧 Solutions possibles :');
  console.log('1. Vérifier que la fonction Edge "send-email" est déployée');
  console.log('2. Vérifier les variables d\'environnement Supabase');
  console.log('3. Vérifier les logs de la fonction Edge');
  console.log('4. Tester avec un email valide');
}

testWelcomeEmail();
