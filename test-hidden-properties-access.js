const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testHiddenPropertiesAccess() {
  try {
    console.log('🔍 Test d\'accès aux propriétés masquées...\n');

    // 1. Récupérer toutes les propriétés pour identifier les masquées
    console.log('📊 Récupération de toutes les propriétés...');
    
    const { data: allProperties, error: allError } = await supabase
      .from('properties')
      .select('id, title, is_active, is_hidden')
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('❌ Erreur lors de la récupération des propriétés:', allError);
      return;
    }

    console.log(`✅ ${allProperties.length} propriété(s) trouvée(s)`);

    // 2. Identifier les propriétés masquées
    const hiddenProperties = allProperties.filter(p => p.is_hidden);
    const inactiveProperties = allProperties.filter(p => !p.is_active);
    
    console.log(`\n📋 Propriétés masquées: ${hiddenProperties.length}`);
    console.log(`📋 Propriétés inactives: ${inactiveProperties.length}`);

    if (hiddenProperties.length === 0 && inactiveProperties.length === 0) {
      console.log('ℹ️  Aucune propriété masquée ou inactive trouvée pour le test');
      return;
    }

    // 3. Tester l'accès aux propriétés masquées
    console.log('\n🔍 Test d\'accès aux propriétés masquées...');
    
    for (const property of hiddenProperties.slice(0, 2)) { // Tester seulement les 2 premières
      console.log(`\n🏠 Test de la propriété: ${property.title} (ID: ${property.id})`);
      
      // Test avec l'ancienne méthode (devrait échouer)
      console.log('   📝 Test avec filtre is_active=true (ancienne méthode)...');
      const { data: oldMethod, error: oldError } = await supabase
        .from('properties')
        .select('id, title, is_active, is_hidden')
        .eq('id', property.id)
        .eq('is_active', true)
        .maybeSingle();

      if (oldError) {
        console.log('   ❌ Erreur avec l\'ancienne méthode:', oldError.message);
      } else if (oldMethod) {
        console.log('   ✅ Propriété trouvée avec l\'ancienne méthode');
      } else {
        console.log('   ⚠️  Propriété non trouvée avec l\'ancienne méthode (masquée)');
      }

      // Test avec la nouvelle méthode (devrait réussir)
      console.log('   📝 Test sans filtre is_active (nouvelle méthode)...');
      const { data: newMethod, error: newError } = await supabase
        .from('properties')
        .select('id, title, is_active, is_hidden')
        .eq('id', property.id)
        .maybeSingle();

      if (newError) {
        console.log('   ❌ Erreur avec la nouvelle méthode:', newError.message);
      } else if (newMethod) {
        console.log('   ✅ Propriété trouvée avec la nouvelle méthode');
        console.log(`      - Titre: ${newMethod.title}`);
        console.log(`      - Active: ${newMethod.is_active}`);
        console.log(`      - Masquée: ${newMethod.is_hidden}`);
      } else {
        console.log('   ❌ Propriété non trouvée avec la nouvelle méthode');
      }
    }

    // 4. Tester l'accès aux propriétés inactives
    console.log('\n🔍 Test d\'accès aux propriétés inactives...');
    
    for (const property of inactiveProperties.slice(0, 2)) { // Tester seulement les 2 premières
      console.log(`\n🏠 Test de la propriété: ${property.title} (ID: ${property.id})`);
      
      // Test avec la nouvelle méthode
      const { data: result, error } = await supabase
        .from('properties')
        .select('id, title, is_active, is_hidden')
        .eq('id', property.id)
        .maybeSingle();

      if (error) {
        console.log('   ❌ Erreur:', error.message);
      } else if (result) {
        console.log('   ✅ Propriété trouvée');
        console.log(`      - Titre: ${result.title}`);
        console.log(`      - Active: ${result.is_active}`);
        console.log(`      - Masquée: ${result.is_hidden}`);
      } else {
        console.log('   ❌ Propriété non trouvée');
      }
    }

    // 5. Test de la fonction getPropertyById simulée
    console.log('\n🧪 Test de la fonction getPropertyById simulée...');
    
    const testProperty = hiddenProperties[0] || inactiveProperties[0];
    if (testProperty) {
      console.log(`\n🔍 Test avec la propriété: ${testProperty.title}`);
      
      // Simuler la fonction getPropertyById
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select(`
          *,
          cities:city_id (
            id,
            name,
            region
          )
        `)
        .eq('id', testProperty.id)
        .maybeSingle();

      if (propertyError) {
        console.log('❌ Erreur lors de la récupération:', propertyError.message);
      } else if (propertyData) {
        console.log('✅ Propriété récupérée avec succès');
        console.log(`   - Titre: ${propertyData.title}`);
        console.log(`   - Active: ${propertyData.is_active}`);
        console.log(`   - Masquée: ${propertyData.is_hidden}`);
        console.log(`   - Prix: ${propertyData.price_per_night} XOF`);
        console.log(`   - Ville: ${propertyData.cities?.name || 'Non définie'}`);
      } else {
        console.log('❌ Propriété non trouvée');
      }
    }

    console.log('\n✅ Test d\'accès aux propriétés masquées terminé !');

  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
  }
}

// Exécuter le test
testHiddenPropertiesAccess();

