/**
 * Script de test pour vérifier que la RPC mark_email_as_verified fonctionne
 * Usage: node test-rpc-email-verification.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRPC() {
  console.log('\n🧪 Test de la fonction RPC mark_email_as_verified\n');

  try {
    // Note: Ce script nécessite une session authentifiée
    // Pour un vrai test, il faudrait se connecter avec un utilisateur
    
    console.log('📋 Vérification de l\'existence de la fonction RPC...');
    
    // Vérifier que la fonction existe en essayant de l'appeler
    // (cela échouera sans authentification, mais on verra si la fonction existe)
    const { data, error } = await supabase.rpc('mark_email_as_verified');
    
    if (error) {
      if (error.message.includes('permission denied') || error.message.includes('not authenticated')) {
        console.log('✅ La fonction RPC existe (erreur d\'authentification attendue)');
        console.log('   Message:', error.message);
      } else if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.error('❌ La fonction RPC n\'existe pas en base de données!');
        console.error('   Il faut exécuter la migration SQL pour créer la fonction.');
        return;
      } else {
        console.error('❌ Erreur inattendue:', error);
        return;
      }
    } else {
      console.log('✅ La fonction RPC existe et a été appelée avec succès');
      console.log('   Résultat:', data);
    }

    console.log('\n📝 Pour tester complètement:');
    console.log('   1. Connectez-vous avec un utilisateur');
    console.log('   2. Vérifiez que email_verified est false');
    console.log('   3. Appelez la RPC mark_email_as_verified()');
    console.log('   4. Vérifiez que email_verified est maintenant true');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

testRPC();

