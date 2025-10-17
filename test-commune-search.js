#!/usr/bin/env node

/**
 * Script de test pour vérifier la recherche par commune
 * Ce script teste les différentes fonctionnalités de recherche implémentées
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase (vous devrez remplacer par vos vraies valeurs)
const supabaseUrl = process.env.SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCommuneSearch() {
  console.log('🔍 Test de la recherche par commune...\n');

  try {
    // Test 1: Rechercher des communes dans la table neighborhoods
    console.log('1. Test de recherche dans les communes:');
    const { data: communes, error: communesError } = await supabase
      .from('neighborhoods')
      .select('id, name, commune, city_id')
      .ilike('commune', '%Cocody%')
      .limit(5);

    if (communesError) {
      console.error('❌ Erreur lors de la recherche des communes:', communesError);
    } else {
      console.log('✅ Communes trouvées:', communes);
    }

    // Test 2: Rechercher des quartiers par nom
    console.log('\n2. Test de recherche dans les quartiers:');
    const { data: neighborhoods, error: neighborhoodsError } = await supabase
      .from('neighborhoods')
      .select('id, name, commune, city_id')
      .ilike('name', '%Angré%')
      .limit(5);

    if (neighborhoodsError) {
      console.error('❌ Erreur lors de la recherche des quartiers:', neighborhoodsError);
    } else {
      console.log('✅ Quartiers trouvés:', neighborhoods);
    }

    // Test 3: Rechercher des villes
    console.log('\n3. Test de recherche dans les villes:');
    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('id, name, region')
      .ilike('name', '%Abidjan%')
      .limit(5);

    if (citiesError) {
      console.error('❌ Erreur lors de la recherche des villes:', citiesError);
    } else {
      console.log('✅ Villes trouvées:', cities);
    }

    // Test 4: Vérifier la structure de la table neighborhoods
    console.log('\n4. Structure de la table neighborhoods:');
    const { data: sampleNeighborhoods, error: sampleError } = await supabase
      .from('neighborhoods')
      .select('*')
      .limit(3);

    if (sampleError) {
      console.error('❌ Erreur lors de la récupération des échantillons:', sampleError);
    } else {
      console.log('✅ Échantillons de quartiers:', sampleNeighborhoods);
    }

    console.log('\n🎉 Tests terminés avec succès!');

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Fonction pour tester la logique de recherche complète
async function testCompleteSearchLogic() {
  console.log('\n🔍 Test de la logique de recherche complète...\n');

  const searchTerms = ['Cocody', 'Angré', 'Abidjan', 'Marcory'];

  for (const term of searchTerms) {
    console.log(`Recherche pour: "${term}"`);
    
    try {
      // 1. Chercher dans les villes
      const { data: cityExists } = await supabase
        .from('cities')
        .select('id, name')
        .ilike('name', term)
        .single();

      if (cityExists) {
        console.log(`  ✅ Ville trouvée: ${cityExists.name}`);
        continue;
      }

      // 2. Chercher dans les communes (priorité avant les quartiers)
      const { data: communeExists } = await supabase
        .from('neighborhoods')
        .select('city_id, name, commune')
        .ilike('commune', term)
        .single();

      if (communeExists) {
        console.log(`  ✅ Commune trouvée: ${communeExists.commune}`);
        continue;
      }

      // 3. Chercher dans les quartiers
      const { data: neighborhoodExists } = await supabase
        .from('neighborhoods')
        .select('city_id, name, commune')
        .ilike('name', term)
        .single();

      if (neighborhoodExists) {
        console.log(`  ✅ Quartier trouvé: ${neighborhoodExists.name} (${neighborhoodExists.commune})`);
      } else {
        console.log(`  ⚠️ Aucun résultat trouvé pour "${term}"`);
      }

    } catch (error) {
      console.error(`  ❌ Erreur pour "${term}":`, error);
    }
  }
}

// Exécuter les tests
async function runTests() {
  console.log('🚀 Démarrage des tests de recherche par commune\n');
  
  await testCommuneSearch();
  await testCompleteSearchLogic();
  
  console.log('\n✨ Tous les tests sont terminés!');
}

// Vérifier si le script est exécuté directement
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testCommuneSearch,
  testCompleteSearchLogic,
  runTests
};
