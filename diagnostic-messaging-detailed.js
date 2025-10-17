// Script de diagnostic détaillé pour la messagerie
const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase (remplacer par vos vraies valeurs)
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosticComplet() {
  console.log('🔍 Diagnostic complet de la messagerie...\n');

  try {
    // 1. Vérifier la structure des tables
    console.log('1. Vérification de la structure des tables:');
    
    // Vérifier conversations
    const { data: convData, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .limit(1);
    
    if (convError) {
      console.log('❌ Erreur table conversations:', convError);
    } else {
      console.log('✅ Table conversations accessible');
      console.log('📋 Structure:', convData.length > 0 ? Object.keys(convData[0]) : 'Aucune donnée');
    }

    // Vérifier conversation_messages
    const { data: msgData, error: msgError } = await supabase
      .from('conversation_messages')
      .select('*')
      .limit(1);
    
    if (msgError) {
      console.log('❌ Erreur table conversation_messages:', msgError);
    } else {
      console.log('✅ Table conversation_messages accessible');
      console.log('📋 Structure:', msgData.length > 0 ? Object.keys(msgData[0]) : 'Aucune donnée');
    }

    // Vérifier profiles
    const { data: profData, error: profError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (profError) {
      console.log('❌ Erreur table profiles:', profError);
    } else {
      console.log('✅ Table profiles accessible');
      console.log('📋 Structure:', profData.length > 0 ? Object.keys(profData[0]) : 'Aucune donnée');
    }

    // 2. Tester la requête exacte du hook
    console.log('\n2. Test de la requête exacte du hook:');
    
    const { data: fullData, error: fullError } = await supabase
      .from('conversations')
      .select(`
        *,
        property:properties(
          id,
          title,
          images
        ),
        host_profile:profiles!conversations_host_id_fkey(
          first_name,
          last_name,
          avatar_url
        ),
        guest_profile:profiles!conversations_guest_id_fkey(
          first_name,
          last_name,
          avatar_url
        )
      `)
      .limit(3);
    
    if (fullError) {
      console.log('❌ Erreur requête complète:', fullError);
    } else {
      console.log('✅ Requête complète réussie');
      console.log('📊 Nombre de conversations:', fullData?.length || 0);
      if (fullData && fullData.length > 0) {
        console.log('📋 Première conversation:', JSON.stringify(fullData[0], null, 2));
      }
    }

    // 3. Vérifier les données de test
    console.log('\n3. Vérification des données de test:');
    
    // Créer une conversation de test si nécessaire
    const testConversation = {
      property_id: 'test-property-id',
      guest_id: 'test-guest-id',
      host_id: 'test-host-id'
    };
    
    console.log('📝 Données de test à insérer:', testConversation);

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Instructions pour l'utilisateur
console.log('📋 Instructions pour le diagnostic:');
console.log('1. Remplacez supabaseUrl et supabaseKey par vos vraies valeurs');
console.log('2. Exécutez le script: node diagnostic-messaging-detailed.js');
console.log('3. Vérifiez les logs pour identifier le problème');
console.log('4. Partagez les résultats avec moi\n');

diagnosticComplet();

