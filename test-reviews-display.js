const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testReviewsDisplay() {
  console.log('🧪 Test de l\'affichage des avis avec prénoms...\n');

  try {
    // Test de la requête avec prénoms
    const { data, error } = await supabase
      .from('properties')
      .select(`
        id,
        title,
        rating,
        review_count,
        reviews!property_id (
          rating,
          comment,
          created_at,
          user_id,
          profiles!reviews_user_id_fkey (
            first_name
          )
        )
      `)
      .eq('is_active', true)
      .eq('is_hidden', false)
      .limit(1);

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('⚠️ Aucune propriété trouvée');
      return;
    }

    const property = data[0];
    console.log('🏠 Propriété:', property.title);
    console.log('📊 Note moyenne:', property.rating);
    console.log('📝 Nombre d\'avis:', property.review_count);
    console.log('');

    if (property.reviews && property.reviews.length > 0) {
      console.log('💬 Avis détaillés:');
      property.reviews.forEach((review, index) => {
        console.log(`\n--- Avis ${index + 1} ---`);
        console.log('👤 Prénom:', review.profiles?.first_name || 'Anonyme');
        console.log('⭐ Note:', review.rating + '/5');
        console.log('📅 Date:', new Date(review.created_at).toLocaleDateString('fr-FR'));
        console.log('💭 Commentaire:', review.comment || 'Aucun commentaire');
      });
    } else {
      console.log('📝 Aucun avis trouvé pour cette propriété');
    }

    console.log('\n✅ Test terminé avec succès !');

  } catch (err) {
    console.error('❌ Erreur lors du test:', err);
  }
}

// Exécuter le test
testReviewsDisplay();
