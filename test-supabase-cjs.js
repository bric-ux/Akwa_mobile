// Test simple pour vérifier la connexion Supabase et les propriétés
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔍 Test de connexion Supabase...');
  
  try {
    // Test 1: Vérifier la connexion
    console.log('1️⃣ Test de connexion...');
    const { data, error } = await supabase
      .from('properties')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Erreur de connexion:', error);
      return;
    }
    
    console.log('✅ Connexion réussie');
    
    // Test 2: Récupérer toutes les propriétés actives
    console.log('\n2️⃣ Récupération des propriétés actives...');
    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('id, title, is_active')
      .eq('is_active', true);
    
    if (propertiesError) {
      console.error('❌ Erreur lors de la récupération des propriétés:', propertiesError);
      return;
    }
    
    console.log(`✅ ${properties?.length || 0} propriétés actives trouvées:`);
    properties?.forEach((prop, index) => {
      console.log(`  ${index + 1}. ${prop.id}: ${prop.title}`);
    });
    
    // Test 3: Tester getPropertyById avec la première propriété
    if (properties && properties.length > 0) {
      const firstProperty = properties[0];
      console.log(`\n3️⃣ Test getPropertyById avec: ${firstProperty.id}`);
      
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select(`
          *,
          cities:city_id (
            id,
            name,
            region
          )
        `)
        .eq('id', firstProperty.id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (propertyError) {
        console.error('❌ Erreur lors de la récupération de la propriété:', propertyError);
      } else if (!property) {
        console.log('❌ Propriété non trouvée');
      } else {
        console.log('✅ Propriété récupérée avec succès:');
        console.log(`  - Titre: ${property.title}`);
        console.log(`  - Prix: ${property.price_per_night} FCFA/nuit`);
        console.log(`  - Ville: ${property.cities?.name || 'Non définie'}`);
        console.log(`  - Images: ${property.images?.length || 0} image(s)`);
        console.log(`  - Équipements: ${property.amenities?.length || 0} équipement(s)`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Exécuter le test
testConnection();
