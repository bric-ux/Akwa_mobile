// Script de test pour vérifier la base de données profiles
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://your-project.supabase.co'; // Remplacez par votre URL
const supabaseKey = 'your-anon-key'; // Remplacez par votre clé

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProfilesTable() {
  console.log('🔍 Test de la table profiles...\n');

  try {
    // 1. Vérifier la structure de la table
    console.log('1️⃣ Vérification de la structure de la table profiles:');
    const { data: structure, error: structureError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (structureError) {
      console.log('❌ Erreur structure:', structureError);
    } else {
      console.log('✅ Structure OK, colonnes disponibles:', Object.keys(structure[0] || {}));
    }

    // 2. Compter le nombre total de profils
    console.log('\n2️⃣ Nombre total de profils:');
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log('❌ Erreur count:', countError);
    } else {
      console.log('✅ Nombre de profils:', count);
    }

    // 3. Lister quelques profils
    console.log('\n3️⃣ Échantillon de profils:');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, created_at')
      .limit(5);
    
    if (profilesError) {
      console.log('❌ Erreur profiles:', profilesError);
    } else {
      console.log('✅ Profils trouvés:');
      profiles.forEach((profile, index) => {
        console.log(`   ${index + 1}. ID: ${profile.id}`);
        console.log(`      Nom: ${profile.first_name} ${profile.last_name}`);
        console.log(`      Email: ${profile.email}`);
        console.log(`      Créé: ${profile.created_at}`);
        console.log('');
      });
    }

    // 4. Vérifier les propriétés et leurs host_id
    console.log('4️⃣ Vérification des propriétés et host_id:');
    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('id, title, host_id')
      .limit(3);
    
    if (propertiesError) {
      console.log('❌ Erreur properties:', propertiesError);
    } else {
      console.log('✅ Propriétés trouvées:');
      properties.forEach((property, index) => {
        console.log(`   ${index + 1}. ID: ${property.id}`);
        console.log(`      Titre: ${property.title}`);
        console.log(`      Host ID: ${property.host_id}`);
        console.log(`      Type host_id: ${typeof property.host_id}`);
        console.log('');
      });
    }

    // 5. Tester la correspondance host_id -> profil
    if (properties && properties.length > 0) {
      const testHostId = properties[0].host_id;
      console.log(`5️⃣ Test de correspondance pour host_id: ${testHostId}`);
      
      const { data: testProfile, error: testError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', testHostId)
        .single();
      
      if (testError) {
        console.log('❌ Erreur test correspondance:', testError);
        console.log('   Code:', testError.code);
        console.log('   Message:', testError.message);
      } else {
        console.log('✅ Correspondance trouvée:');
        console.log('   Profil:', testProfile);
      }
    }

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Instructions pour utiliser ce script
console.log('📋 INSTRUCTIONS:');
console.log('1. Remplacez supabaseUrl et supabaseKey par vos vraies valeurs');
console.log('2. Exécutez: node test-profiles-database.js');
console.log('3. Vérifiez les logs pour identifier le problème\n');

testProfilesTable();
