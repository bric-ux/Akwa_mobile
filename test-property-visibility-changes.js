const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPropertyVisibilityChanges() {
  try {
    console.log('🔍 Test des changements de visibilité des propriétés...\n');

    // 1. Récupérer toutes les propriétés
    console.log('📊 Récupération de toutes les propriétés...');
    
    const { data: allProperties, error: allError } = await supabase
      .from('properties')
      .select('id, title, is_active, is_hidden, created_at')
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('❌ Erreur lors de la récupération des propriétés:', allError);
      return;
    }

    console.log(`✅ ${allProperties.length} propriété(s) trouvée(s)`);

    if (allProperties.length === 0) {
      console.log('ℹ️  Aucune propriété trouvée pour le test');
      return;
    }

    // 2. Identifier les propriétés visibles (actives ET non masquées)
    const visibleProperties = allProperties.filter(p => p.is_active && !p.is_hidden);
    const hiddenProperties = allProperties.filter(p => p.is_hidden);
    const inactiveProperties = allProperties.filter(p => !p.is_active);
    
    console.log(`\n📋 Propriétés visibles (actives ET non masquées): ${visibleProperties.length}`);
    console.log(`📋 Propriétés masquées: ${hiddenProperties.length}`);
    console.log(`📋 Propriétés inactives: ${inactiveProperties.length}`);

    // 3. Tester la requête pour l'accueil (comme dans useProperties)
    console.log('\n🏠 Test de la requête pour l\'accueil...');
    
    const { data: homeProperties, error: homeError } = await supabase
      .from('properties')
      .select(`
        id, title, is_active, is_hidden, price_per_night,
        cities:city_id (
          id, name, region
        )
      `)
      .eq('is_active', true)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false });

    if (homeError) {
      console.error('❌ Erreur lors de la requête pour l\'accueil:', homeError);
    } else {
      console.log(`✅ ${homeProperties.length} propriété(s) visible(s) sur l'accueil`);
      
      if (homeProperties.length > 0) {
        console.log('\n📝 Propriétés visibles sur l\'accueil:');
        homeProperties.forEach((property, index) => {
          console.log(`   ${index + 1}. ${property.title}`);
          console.log(`      - Prix: ${property.price_per_night} XOF`);
          console.log(`      - Ville: ${property.cities?.name || 'Non définie'}`);
          console.log(`      - Active: ${property.is_active}`);
          console.log(`      - Masquée: ${property.is_hidden}`);
        });
      }
    }

    // 4. Simuler un changement de visibilité (masquer une propriété)
    if (visibleProperties.length > 0) {
      const propertyToHide = visibleProperties[0];
      console.log(`\n🔒 Simulation du masquage de la propriété: ${propertyToHide.title}`);
      
      // Masquer la propriété
      const { error: hideError } = await supabase
        .from('properties')
        .update({ is_hidden: true })
        .eq('id', propertyToHide.id);

      if (hideError) {
        console.log('❌ Erreur lors du masquage:', hideError.message);
      } else {
        console.log('✅ Propriété masquée avec succès');
        
        // Vérifier que la propriété n'apparaît plus sur l'accueil
        const { data: updatedHomeProperties, error: updatedError } = await supabase
          .from('properties')
          .select('id, title, is_active, is_hidden')
          .eq('is_active', true)
          .eq('is_hidden', false)
          .order('created_at', { ascending: false });

        if (updatedError) {
          console.log('❌ Erreur lors de la vérification:', updatedError.message);
        } else {
          const stillVisible = updatedHomeProperties.find(p => p.id === propertyToHide.id);
          if (stillVisible) {
            console.log('❌ PROBLÈME: La propriété masquée est toujours visible sur l\'accueil !');
          } else {
            console.log('✅ SUCCÈS: La propriété masquée n\'apparaît plus sur l\'accueil');
            console.log(`   - Propriétés visibles avant: ${homeProperties.length}`);
            console.log(`   - Propriétés visibles après: ${updatedHomeProperties.length}`);
          }
        }
        
        // Remettre la propriété visible
        console.log('\n🔓 Remise en visibilité de la propriété...');
        const { error: showError } = await supabase
          .from('properties')
          .update({ is_hidden: false })
          .eq('id', propertyToHide.id);

        if (showError) {
          console.log('❌ Erreur lors de la remise en visibilité:', showError.message);
        } else {
          console.log('✅ Propriété remise en visibilité avec succès');
        }
      }
    }

    // 5. Tester l'accès aux propriétés masquées (pour la modification)
    if (hiddenProperties.length > 0) {
      const hiddenProperty = hiddenProperties[0];
      console.log(`\n🔍 Test d'accès à la propriété masquée: ${hiddenProperty.title}`);
      
      // Test avec l'ancienne méthode (devrait échouer)
      const { data: oldMethod, error: oldError } = await supabase
        .from('properties')
        .select('id, title, is_active, is_hidden')
        .eq('id', hiddenProperty.id)
        .eq('is_active', true)
        .maybeSingle();

      if (oldError) {
        console.log('❌ Erreur avec l\'ancienne méthode:', oldError.message);
      } else if (oldMethod) {
        console.log('✅ Propriété trouvée avec l\'ancienne méthode');
      } else {
        console.log('⚠️  Propriété non trouvée avec l\'ancienne méthode (masquée)');
      }

      // Test avec la nouvelle méthode (devrait réussir)
      const { data: newMethod, error: newError } = await supabase
        .from('properties')
        .select('id, title, is_active, is_hidden')
        .eq('id', hiddenProperty.id)
        .maybeSingle();

      if (newError) {
        console.log('❌ Erreur avec la nouvelle méthode:', newError.message);
      } else if (newMethod) {
        console.log('✅ Propriété trouvée avec la nouvelle méthode');
        console.log(`   - Titre: ${newMethod.title}`);
        console.log(`   - Active: ${newMethod.is_active}`);
        console.log(`   - Masquée: ${newMethod.is_hidden}`);
      } else {
        console.log('❌ Propriété non trouvée avec la nouvelle méthode');
      }
    }

    // 6. Résumé des tests
    console.log('\n📊 Résumé des tests:');
    console.log(`   - Propriétés totales: ${allProperties.length}`);
    console.log(`   - Propriétés visibles sur l'accueil: ${homeProperties.length}`);
    console.log(`   - Propriétés masquées: ${hiddenProperties.length}`);
    console.log(`   - Propriétés inactives: ${inactiveProperties.length}`);
    
    console.log('\n✅ Test des changements de visibilité terminé !');

  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
  }
}

// Exécuter le test
testPropertyVisibilityChanges();

