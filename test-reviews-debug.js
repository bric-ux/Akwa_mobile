const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase - Remplacez par vos vraies clés
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testReviewsDebug() {
  console.log('🔍 Debug complet des avis...\n');

  try {
    // Test 1: Vérifier s'il y a des avis
    console.log('1️⃣ Vérification des avis...');
    const { data: reviewsData, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .limit(5);

    if (reviewsError) {
      console.error('❌ Erreur reviews:', reviewsError);
      return;
    }

    console.log('📊 Nombre d\'avis trouvés:', reviewsData?.length || 0);
    if (reviewsData && reviewsData.length > 0) {
      console.log('📋 Premier avis:', reviewsData[0]);
    }

    // Test 2: Vérifier les profils
    console.log('\n2️⃣ Vérification des profils...');
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, first_name')
      .limit(5);

    if (profilesError) {
      console.error('❌ Erreur profiles:', profilesError);
      return;
    }

    console.log('📊 Nombre de profils trouvés:', profilesData?.length || 0);
    if (profilesData && profilesData.length > 0) {
      console.log('📋 Premier profil:', profilesData[0]);
    }

    // Test 3: Test de jointure manuelle
    if (reviewsData && reviewsData.length > 0 && profilesData && profilesData.length > 0) {
      console.log('\n3️⃣ Test de jointure manuelle...');
      const firstReview = reviewsData[0];
      const reviewerId = firstReview.reviewer_id;
      
      console.log('🔍 Reviewer ID:', reviewerId);
      
      const matchingProfile = profilesData.find(p => p.user_id === reviewerId);
      console.log('🔍 Profil correspondant:', matchingProfile);
      
      if (matchingProfile) {
        console.log('✅ Jointure réussie:', reviewerId, '->', matchingProfile.first_name);
      } else {
        console.log('❌ Aucun profil trouvé pour reviewer_id:', reviewerId);
      }
    }

    // Test 4: Test avec une propriété spécifique
    console.log('\n4️⃣ Test avec une propriété...');
    const { data: propertyData, error: propertyError } = await supabase
      .from('properties')
      .select(`
        id,
        title,
        reviews!property_id (
          rating,
          comment,
          created_at,
          reviewer_id
        )
      `)
      .eq('is_active', true)
      .limit(1);

    if (propertyError) {
      console.error('❌ Erreur propriété:', propertyError);
      return;
    }

    if (propertyData && propertyData.length > 0) {
      const property = propertyData[0];
      console.log('🏠 Propriété:', property.title);
      console.log('📝 Avis de la propriété:', property.reviews);
      
      if (property.reviews && property.reviews.length > 0) {
        const review = property.reviews[0];
        console.log('🔍 Premier avis:', review);
        console.log('🔍 Reviewer ID:', review.reviewer_id);
      }
    }

  } catch (err) {
    console.error('❌ Erreur générale:', err);
  }
}

// Exécuter le test
testReviewsDebug();

