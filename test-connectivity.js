// Test de connectivité Supabase pour diagnostiquer l'erreur réseau
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

console.log('🔍 Test de connectivité Supabase...');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey.substring(0, 20) + '...');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // Désactiver la persistance pour le test
    autoRefreshToken: false,
  }
});

async function testConnectivity() {
  try {
    console.log('\n1️⃣ Test de connexion de base...');
    
    // Test simple de ping
    const { data, error } = await supabase
      .from('properties')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Erreur de connexion:', error);
      console.error('Code:', error.code);
      console.error('Message:', error.message);
      console.error('Details:', error.details);
      console.error('Hint:', error.hint);
      return;
    }
    
    console.log('✅ Connexion de base réussie');
    
    console.log('\n2️⃣ Test de récupération des propriétés...');
    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('id, title, is_active')
      .eq('is_active', true)
      .limit(5);
    
    if (propertiesError) {
      console.error('❌ Erreur lors de la récupération des propriétés:', propertiesError);
      return;
    }
    
    console.log(`✅ ${properties?.length || 0} propriétés récupérées`);
    
    if (properties && properties.length > 0) {
      console.log('\n3️⃣ Test getPropertyById...');
      const firstProperty = properties[0];
      console.log('Test avec ID:', firstProperty.id);
      
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
        console.error('❌ Erreur getPropertyById:', propertyError);
        console.error('Code:', propertyError.code);
        console.error('Message:', propertyError.message);
        console.error('Details:', propertyError.details);
        console.error('Hint:', propertyError.hint);
      } else if (!property) {
        console.log('❌ Propriété non trouvée');
      } else {
        console.log('✅ Propriété récupérée avec succès');
        console.log('Titre:', property.title);
        console.log('Prix:', property.price_per_night);
        console.log('Ville:', property.cities?.name);
      }
    }
    
    console.log('\n4️⃣ Test de la table cities...');
    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('id, name, region')
      .limit(5);
    
    if (citiesError) {
      console.error('❌ Erreur lors de la récupération des villes:', citiesError);
    } else {
      console.log(`✅ ${cities?.length || 0} villes récupérées`);
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
    console.error('Type:', typeof error);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Exécuter le test
testConnectivity();

