const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase - Remplacez par vos vraies clés
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testReviewsRelation() {
  console.log('🧪 Test de la relation reviews -> profiles...\n');

  try {
    // Test 1: Vérifier la structure de la table reviews
    console.log('1️⃣ Test de la structure de la table reviews...');
    const { data: reviewsData, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .limit(1);

    if (reviewsError) {
      console.error('❌ Erreur reviews:', reviewsError);
    } else {
      console.log('✅ Table reviews accessible');
      if (reviewsData && reviewsData.length > 0) {
        console.log('📋 Colonnes reviews:', Object.keys(reviewsData[0]));
      }
    }

    // Test 2: Vérifier la structure de la table profiles
    console.log('\n2️⃣ Test de la structure de la table profiles...');
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (profilesError) {
      console.error('❌ Erreur profiles:', profilesError);
    } else {
      console.log('✅ Table profiles accessible');
      if (profilesData && profilesData.length > 0) {
        console.log('📋 Colonnes profiles:', Object.keys(profilesData[0]));
      }
    }

    // Test 3: Test de la jointure reviews -> profiles
    console.log('\n3️⃣ Test de la jointure reviews -> profiles...');
    const { data: joinData, error: joinError } = await supabase
      .from('reviews')
      .select(`
        rating,
        comment,
        created_at,
        reviewer_id,
        profiles:reviewer_id (
          first_name
        )
      `)
      .limit(1);

    if (joinError) {
      console.error('❌ Erreur jointure:', joinError);
    } else {
      console.log('✅ Jointure réussie');
      if (joinData && joinData.length > 0) {
        console.log('📋 Données jointes:', JSON.stringify(joinData[0], null, 2));
      }
    }

    // Test 4: Test complet avec properties
    console.log('\n4️⃣ Test complet properties -> reviews -> profiles...');
    const { data: fullData, error: fullError } = await supabase
      .from('properties')
      .select(`
        id,
        title,
        reviews!property_id (
          rating,
          comment,
          created_at,
          reviewer_id,
          profiles:reviewer_id (
            first_name
          )
        )
      `)
      .eq('is_active', true)
      .limit(1);

    if (fullError) {
      console.error('❌ Erreur requête complète:', fullError);
    } else {
      console.log('✅ Requête complète réussie');
      if (fullData && fullData.length > 0) {
        console.log('📋 Données complètes:', JSON.stringify(fullData[0], null, 2));
      }
    }

  } catch (err) {
    console.error('❌ Erreur générale:', err);
  }
}

// Exécuter le test
testReviewsRelation();
