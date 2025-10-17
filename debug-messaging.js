// Script de diagnostic pour la messagerie
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://your-project.supabase.co'; // Remplacer par votre URL
const supabaseKey = 'your-anon-key'; // Remplacer par votre clé

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosticMessaging() {
  console.log('🔍 Diagnostic de la messagerie...\n');

  try {
    // 1. Vérifier les conversations
    console.log('1. Vérification des conversations:');
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .limit(5);
    
    if (convError) {
      console.log('❌ Erreur conversations:', convError);
    } else {
      console.log('✅ Conversations trouvées:', conversations?.length || 0);
      console.log('📋 Détails:', conversations);
    }

    // 2. Vérifier les messages
    console.log('\n2. Vérification des messages:');
    const { data: messages, error: msgError } = await supabase
      .from('conversation_messages')
      .select('*')
      .limit(5);
    
    if (msgError) {
      console.log('❌ Erreur messages:', msgError);
    } else {
      console.log('✅ Messages trouvés:', messages?.length || 0);
      console.log('📋 Détails:', messages);
    }

    // 3. Vérifier les profils
    console.log('\n3. Vérification des profils:');
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('*')
      .limit(3);
    
    if (profError) {
      console.log('❌ Erreur profils:', profError);
    } else {
      console.log('✅ Profils trouvés:', profiles?.length || 0);
    }

    // 4. Test de la requête complète
    console.log('\n4. Test de la requête complète:');
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
      console.log('✅ Requête complète réussie:', fullData?.length || 0);
      console.log('📋 Détails:', JSON.stringify(fullData, null, 2));
    }

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

diagnosticMessaging();

