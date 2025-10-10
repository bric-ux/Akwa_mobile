// Test pour vérifier que les propriétés sont bien récupérées avec le hook useProperties
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseKey);

// Fonction pour mapper les équipements (simulation de mapAmenities)
async function mapAmenities(amenityNames) {
  if (!amenityNames || !Array.isArray(amenityNames) || amenityNames.length === 0) {
    return [];
  }

  try {
    const { data: amenities, error } = await supabase
      .from('property_amenities')
      .select('*');

    if (error) throw error;

    return amenityNames
      .map(name => {
        const amenity = amenities?.find(a => a.name === name);
        return amenity ? {
          id: amenity.id,
          name: amenity.name,
          icon: '🏠' // Icône simple pour le test
        } : null;
      })
      .filter(Boolean);
  } catch (err) {
    console.error('Erreur lors du chargement des équipements:', err);
    return [];
  }
}

async function testPropertiesHook() {
  console.log('🔍 Test du hook useProperties...');
  
  try {
    // Simuler fetchProperties
    console.log('1️⃣ Récupération des propriétés...');
    const { data, error } = await supabase
      .from('properties')
      .select(`
        *,
        cities:city_id (
          id,
          name,
          region
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur lors de la récupération des propriétés:', error);
      return;
    }

    console.log(`✅ ${data?.length || 0} propriétés récupérées`);

    // Transformer les données comme dans le hook
    const transformedProperties = await Promise.all(
      data.map(async (property) => {
        const mappedAmenities = await mapAmenities(property.amenities);
        
        return {
          ...property,
          images: property.images || [],
          price_per_night: property.price_per_night || Math.floor(Math.random() * 50000) + 10000,
          rating: Math.random() * 2 + 3,
          reviews_count: Math.floor(Math.random() * 50) + 5,
          amenities: mappedAmenities
        };
      })
    );

    console.log('\n2️⃣ Propriétés transformées:');
    transformedProperties.forEach((prop, index) => {
      console.log(`  ${index + 1}. ${prop.title}`);
      console.log(`     - ID: ${prop.id}`);
      console.log(`     - Prix: ${prop.price_per_night} FCFA/nuit`);
      console.log(`     - Ville: ${prop.cities?.name || 'Non définie'}`);
      console.log(`     - Images: ${prop.images?.length || 0} image(s)`);
      console.log(`     - Équipements: ${prop.amenities?.length || 0} équipement(s)`);
      console.log(`     - Note: ${prop.rating?.toFixed(1)} (${prop.reviews_count} avis)`);
      console.log('');
    });

    // Test getPropertyById avec la première propriété
    if (transformedProperties.length > 0) {
      const firstProperty = transformedProperties[0];
      console.log(`3️⃣ Test getPropertyById avec: ${firstProperty.id}`);
      
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
testPropertiesHook();
