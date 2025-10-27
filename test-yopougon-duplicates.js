#!/usr/bin/env node

/**
 * Script de test spécifique pour tester les doublons de communes
 * Teste le cas de Yopougon qui peut avoir plusieurs quartiers
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase (vous devrez remplacer par vos vraies valeurs)
const supabaseUrl = process.env.SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testYopougonDuplicates() {
  console.log('🔍 Test spécifique pour Yopougon - Éviter les doublons de communes\n');

  try {
    // Test 1: Vérifier combien de quartiers appartiennent à Yopougon
    console.log('1. Quartiers dans la commune Yopougon:');
    const { data: yopougonNeighborhoods, error: neighborhoodsError } = await supabase
      .from('neighborhoods')
      .select('id, name, commune')
      .ilike('commune', '%Yopougon%');

    if (neighborhoodsError) {
      console.error('❌ Erreur lors de la recherche des quartiers Yopougon:', neighborhoodsError);
    } else {
      console.log(`✅ ${yopougonNeighborhoods.length} quartiers trouvés dans Yopougon:`);
      yopougonNeighborhoods.forEach((neighborhood, index) => {
        console.log(`   ${index + 1}. ${neighborhood.name} (${neighborhood.commune})`);
      });
    }

    // Test 2: Simuler la recherche de communes (ancienne méthode - avec doublons)
    console.log('\n2. Ancienne méthode (avec doublons):');
    const { data: communesOld, error: communesOldError } = await supabase
      .from('neighborhoods')
      .select('id, name, commune')
      .ilike('commune', '%Yopougon%')
      .limit(5);

    if (!communesOldError && communesOld) {
      console.log('❌ Résultats avec doublons:');
      communesOld.forEach((commune, index) => {
        console.log(`   ${index + 1}. ${commune.commune} (ID: ${commune.id})`);
      });
    }

    // Test 3: Nouvelle méthode (sans doublons)
    console.log('\n3. Nouvelle méthode (sans doublons):');
    const { data: communesNew, error: communesNewError } = await supabase
      .from('neighborhoods')
      .select('commune')
      .ilike('commune', '%Yopougon%')
      .limit(5);

    if (!communesNewError && communesNew) {
      // Éviter les doublons de communes en utilisant un Set
      const uniqueCommunes = [...new Set(communesNew.map(c => c.commune))];
      
      console.log('✅ Résultats sans doublons:');
      uniqueCommunes.forEach((communeName, index) => {
        console.log(`   ${index + 1}. ${communeName}`);
      });
      
      console.log(`\n📊 Comparaison: ${communesOld?.length || 0} résultats → ${uniqueCommunes.length} résultats uniques`);
    }

    // Test 4: Test avec d'autres communes qui pourraient avoir des doublons
    console.log('\n4. Test avec d\'autres communes:');
    const testCommunes = ['Cocody', 'Marcory', 'Treichville', 'Adjamé'];
    
    for (const communeName of testCommunes) {
      const { data: communeData, error: communeError } = await supabase
        .from('neighborhoods')
        .select('commune')
        .ilike('commune', `%${communeName}%`)
        .limit(10);

      if (!communeError && communeData) {
        const uniqueCommunes = [...new Set(communeData.map(c => c.commune))];
        console.log(`   ${communeName}: ${communeData.length} résultats → ${uniqueCommunes.length} uniques`);
      }
    }

    console.log('\n🎉 Test terminé avec succès!');

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Fonction pour tester la logique complète de suggestions
async function testSuggestionLogic() {
  console.log('\n🔍 Test de la logique complète de suggestions...\n');

  const searchQuery = 'Yopougon';
  console.log(`Recherche pour: "${searchQuery}"`);

  try {
    const suggestions = [];

    // 1. Recherche dans les villes
    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('id, name, region')
      .ilike('name', `%${searchQuery}%`)
      .limit(5);

    if (!citiesError && cities) {
      cities.forEach((city) => {
        suggestions.push({
          id: `city_${city.id}`,
          text: city.name,
          type: 'city',
          subtitle: `${city.region} • Ville`,
        });
      });
    }

    // 2. Recherche dans les communes (nouvelle méthode sans doublons)
    const { data: communes, error: communesError } = await supabase
      .from('neighborhoods')
      .select('commune')
      .ilike('commune', `%${searchQuery}%`)
      .limit(5);

    if (!communesError && communes) {
      const uniqueCommunes = [...new Set(communes.map(c => c.commune))];
      
      uniqueCommunes.forEach((communeName, index) => {
        suggestions.push({
          id: `commune_${index}`,
          text: communeName,
          type: 'commune',
          subtitle: 'Commune',
        });
      });
    }

    // 3. Recherche dans les quartiers
    const { data: neighborhoods, error: neighborhoodsError } = await supabase
      .from('neighborhoods')
      .select('id, name, commune')
      .ilike('name', `%${searchQuery}%`)
      .limit(5);

    if (!neighborhoodsError && neighborhoods) {
      neighborhoods.forEach((neighborhood) => {
        suggestions.push({
          id: `neighborhood_${neighborhood.id}`,
          text: neighborhood.name,
          type: 'neighborhood',
          subtitle: `${neighborhood.commune} • Quartier`,
        });
      });
    }

    console.log('\n📋 Suggestions finales:');
    suggestions.forEach((suggestion, index) => {
      console.log(`   ${index + 1}. ${suggestion.text} (${suggestion.type}) - ${suggestion.subtitle}`);
    });

    // Vérifier s'il y a des doublons
    const communeSuggestions = suggestions.filter(s => s.type === 'commune');
    const communeNames = communeSuggestions.map(s => s.text);
    const uniqueCommuneNames = [...new Set(communeNames)];
    
    if (communeNames.length !== uniqueCommuneNames.length) {
      console.log('\n❌ DOUBLONS DÉTECTÉS dans les communes!');
    } else {
      console.log('\n✅ Aucun doublon détecté dans les communes');
    }

  } catch (error) {
    console.error('❌ Erreur lors du test des suggestions:', error);
  }
}

// Exécuter les tests
async function runTests() {
  console.log('🚀 Démarrage des tests pour éviter les doublons de communes\n');
  
  await testYopougonDuplicates();
  await testSuggestionLogic();
  
  console.log('\n✨ Tous les tests sont terminés!');
}

// Vérifier si le script est exécuté directement
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testYopougonDuplicates,
  testSuggestionLogic,
  runTests
};








