// Script de test pour vérifier les avis en base de données

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase (remplacez par vos vraies clés)
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testReviewsInDatabase() {
  console.log('🧪 Test des avis en base de données...\n');

  try {
    // 1. Vérifier toutes les propriétés
    console.log('1. Récupération de toutes les propriétés...');
    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('id, title, rating, review_count')
      .limit(5);

    if (propertiesError) {
      console.error('❌ Erreur propriétés:', propertiesError);
      return;
    }

    console.log('✅ Propriétés trouvées:', properties.length);
    properties.forEach(prop => {
      console.log(`   - ${prop.title}: rating=${prop.rating}, review_count=${prop.review_count}`);
    });

    // 2. Vérifier tous les avis
    console.log('\n2. Récupération de tous les avis...');
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('id, property_id, rating, comment, created_at')
      .limit(10);

    if (reviewsError) {
      console.error('❌ Erreur avis:', reviewsError);
      return;
    }

    console.log('✅ Avis trouvés:', reviews.length);
    reviews.forEach(review => {
      console.log(`   - Property: ${review.property_id}, Rating: ${review.rating}, Comment: ${review.comment?.substring(0, 50)}...`);
    });

    // 3. Vérifier la relation
    console.log('\n3. Test de la relation propriétés-avis...');
    const { data: propertiesWithReviews, error: relationError } = await supabase
      .from('properties')
      .select(`
        id,
        title,
        reviews!property_id (
          rating,
          comment
        )
      `)
      .limit(3);

    if (relationError) {
      console.error('❌ Erreur relation:', relationError);
      return;
    }

    console.log('✅ Relation testée:');
    propertiesWithReviews.forEach(prop => {
      console.log(`   - ${prop.title}:`);
      console.log(`     Reviews: ${prop.reviews?.length || 0}`);
      if (prop.reviews && prop.reviews.length > 0) {
        prop.reviews.forEach((review, index) => {
          console.log(`       ${index + 1}. Rating: ${review.rating}, Comment: ${review.comment?.substring(0, 30)}...`);
        });
      }
    });

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Exécuter le test
testReviewsInDatabase();
