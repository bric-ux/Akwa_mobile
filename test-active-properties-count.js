// Script de test pour vérifier que seules les propriétés actives et visibles sont comptées
const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testActivePropertiesCount() {
  console.log('🔍 Test: Vérification du comptage des propriétés actives et visibles...\n');
  
  try {
    // 1. Compter toutes les propriétés
    console.log('📊 1. Compter toutes les propriétés...');
    
    const { data: allProperties, error: allError } = await supabase
      .from('properties')
      .select('id, title, is_active, is_hidden, cities(id, name)');
    
    if (allError) {
      console.error('❌ Erreur lors du comptage de toutes les propriétés:', allError);
      return;
    }
    
    console.log(`📊 Total des propriétés: ${allProperties.length}`);
    
    // 2. Compter les propriétés actives et visibles
    console.log('\n📊 2. Compter les propriétés actives et visibles...');
    
    const { data: activeProperties, error: activeError } = await supabase
      .from('properties')
      .select('id, title, is_active, is_hidden, cities(id, name)')
      .eq('is_active', true)
      .eq('is_hidden', false);
    
    if (activeError) {
      console.error('❌ Erreur lors du comptage des propriétés actives:', activeError);
      return;
    }
    
    console.log(`📊 Propriétés actives et visibles: ${activeProperties.length}`);
    
    // 3. Analyser par ville
    console.log('\n🏙️ 3. Analyse par ville...');
    
    const cityCounts: { [key: string]: { total: number, active: number, cityName: string } } = {};
    
    // Compter toutes les propriétés par ville
    allProperties?.forEach((property: any) => {
      const city = property.cities;
      if (city) {
        const cityId = city.id;
        if (!cityCounts[cityId]) {
          cityCounts[cityId] = { total: 0, active: 0, cityName: city.name };
        }
        cityCounts[cityId].total++;
      }
    });
    
    // Compter les propriétés actives par ville
    activeProperties?.forEach((property: any) => {
      const city = property.cities;
      if (city) {
        const cityId = city.id;
        if (cityCounts[cityId]) {
          cityCounts[cityId].active++;
        }
      }
    });
    
    console.log('\n📋 Détails par ville:');
    Object.entries(cityCounts).forEach(([cityId, data]) => {
      console.log(`   🏙️ ${data.cityName}:`);
      console.log(`      - Total: ${data.total} propriétés`);
      console.log(`      - Actives et visibles: ${data.active} propriétés`);
      if (data.total !== data.active) {
        console.log(`      ⚠️  ${data.total - data.active} propriétés inactives ou masquées`);
      }
      console.log('');
    });
    
    // 4. Vérifier la requête utilisée dans useCities
    console.log('🔍 4. Test de la requête useCities...');
    
    const { data: citiesData, error: citiesError } = await supabase
      .from('properties')
      .select(`
        cities!inner(
          id,
          name,
          region,
          country
        )
      `)
      .eq('is_active', true)
      .eq('is_hidden', false)
      .not('cities', 'is', null);
    
    if (citiesError) {
      console.error('❌ Erreur lors du test de la requête useCities:', citiesError);
      return;
    }
    
    console.log(`✅ Requête useCities retourne ${citiesData.length} propriétés actives et visibles`);
    
    // Compter par ville avec la nouvelle requête
    const newCityCounts: { [key: string]: number } = {};
    citiesData?.forEach((property: any) => {
      const city = property.cities;
      if (city) {
        const cityId = city.id;
        newCityCounts[cityId] = (newCityCounts[cityId] || 0) + 1;
      }
    });
    
    console.log('\n📊 Comptage avec la nouvelle requête:');
    Object.entries(newCityCounts).forEach(([cityId, count]) => {
      const cityName = citiesData.find((p: any) => p.cities.id === cityId)?.cities.name;
      console.log(`   🏙️ ${cityName}: ${count} propriétés actives et visibles`);
    });
    
    console.log('\n🎯 RÉSUMÉ:');
    console.log(`   📊 Total des propriétés: ${allProperties.length}`);
    console.log(`   ✅ Propriétés actives et visibles: ${activeProperties.length}`);
    console.log(`   🔍 Requête useCities: ${citiesData.length} propriétés`);
    
    if (activeProperties.length === citiesData.length) {
      console.log('\n🎉 SUCCÈS: La requête useCities compte correctement les propriétés actives et visibles !');
    } else {
      console.log('\n❌ ERREUR: La requête useCities ne compte pas correctement les propriétés');
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Exécuter le test
testActivePropertiesCount();
