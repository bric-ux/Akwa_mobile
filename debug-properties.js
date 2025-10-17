// Script de diagnostic pour vérifier les propriétés dans la base de données
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-project.supabase.co'; // Remplacez par votre URL
const supabaseKey = 'your-anon-key'; // Remplacez par votre clé

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProperties() {
  console.log('🔍 Vérification des propriétés dans la base de données...');
  
  try {
    // 1. Vérifier toutes les propriétés actives
    const { data: allProperties, error: allError } = await supabase
      .from('properties')
      .select('id, title, is_active, city_id')
      .eq('is_active', true);
    
    if (allError) {
      console.error('❌ Erreur lors de la récupération des propriétés:', allError);
      return;
    }
    
    console.log(`✅ ${allProperties?.length || 0} propriétés actives trouvées:`);
    allProperties?.forEach(prop => {
      console.log(`  - ${prop.id}: ${prop.title} (ville: ${prop.city_id})`);
    });
    
    // 2. Vérifier les propriétés avec leurs villes
    const { data: propertiesWithCities, error: citiesError } = await supabase
      .from('properties')
      .select(`
        id,
        title,
        is_active,
        cities:city_id (
          id,
          name,
          region
        )
      `)
      .eq('is_active', true)
      .limit(5);
    
    if (citiesError) {
      console.error('❌ Erreur lors de la récupération avec villes:', citiesError);
      return;
    }
    
    console.log('\n🏙️ Propriétés avec informations de ville:');
    propertiesWithCities?.forEach(prop => {
      console.log(`  - ${prop.id}: ${prop.title}`);
      console.log(`    Ville: ${prop.cities?.name || 'Non définie'} (${prop.cities?.region || 'Région non définie'})`);
    });
    
    // 3. Vérifier les équipements
    const { data: amenities, error: amenitiesError } = await supabase
      .from('property_amenities')
      .select('*')
      .limit(5);
    
    if (amenitiesError) {
      console.error('❌ Erreur lors de la récupération des équipements:', amenitiesError);
    } else {
      console.log(`\n🏠 ${amenities?.length || 0} équipements disponibles:`);
      amenities?.forEach(amenity => {
        console.log(`  - ${amenity.name} (${amenity.category})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Exécuter le diagnostic
checkProperties();


