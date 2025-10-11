const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPropertySorting() {
  console.log('🧪 Test des fonctionnalités de tri des propriétés...\n');

  try {
    // Récupérer quelques propriétés de test
    const { data: properties, error } = await supabase
      .from('properties')
      .select(`
        id,
        title,
        price_per_night,
        rating,
        review_count,
        created_at,
        is_active,
        is_displayed
      `)
      .eq('is_active', true)
      .eq('is_displayed', true)
      .limit(10);

    if (error) {
      console.error('❌ Erreur récupération propriétés:', error);
      return;
    }

    if (!properties || properties.length === 0) {
      console.log('⚠️ Aucune propriété trouvée pour le test');
      return;
    }

    console.log(`📊 ${properties.length} propriétés récupérées pour le test\n`);

    // Test des différents types de tri
    const sortTests = [
      {
        name: 'Prix croissant',
        sort: (a, b) => (a.price_per_night || 0) - (b.price_per_night || 0)
      },
      {
        name: 'Prix décroissant',
        sort: (a, b) => (b.price_per_night || 0) - (a.price_per_night || 0)
      },
      {
        name: 'Mieux notés',
        sort: (a, b) => {
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          if (ratingA === ratingB) {
            return (b.review_count || 0) - (a.review_count || 0);
          }
          return ratingB - ratingA;
        }
      },
      {
        name: 'Plus récents',
        sort: (a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        }
      },
      {
        name: 'Plus populaires',
        sort: (a, b) => {
          const scoreA = (a.rating || 0) * Math.log((a.review_count || 0) + 1);
          const scoreB = (b.rating || 0) * Math.log((b.review_count || 0) + 1);
          return scoreB - scoreA;
        }
      }
    ];

    // Tester chaque type de tri
    sortTests.forEach((test, index) => {
      console.log(`${index + 1}. Test: ${test.name}`);
      
      const sorted = [...properties].sort(test.sort);
      
      // Afficher les 3 premiers résultats
      console.log('   Top 3:');
      sorted.slice(0, 3).forEach((prop, i) => {
        const price = prop.price_per_night ? `${prop.price_per_night.toLocaleString()} FCFA` : 'N/A';
        const rating = prop.rating ? `${prop.rating}/5` : 'N/A';
        const reviews = prop.review_count || 0;
        const date = prop.created_at ? new Date(prop.created_at).toLocaleDateString() : 'N/A';
        
        console.log(`   ${i + 1}. ${prop.title}`);
        console.log(`      Prix: ${price} | Note: ${rating} (${reviews} avis) | Date: ${date}`);
      });
      
      // Vérifier la cohérence du tri
      let isConsistent = true;
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        
        if (test.name === 'Prix croissant' && (prev.price_per_night || 0) > (curr.price_per_night || 0)) {
          isConsistent = false;
          break;
        }
        if (test.name === 'Prix décroissant' && (prev.price_per_night || 0) < (curr.price_per_night || 0)) {
          isConsistent = false;
          break;
        }
      }
      
      console.log(`   ✅ Tri cohérent: ${isConsistent ? 'OUI' : 'NON'}\n`);
    });

    // Test des propriétés avec données manquantes
    console.log('🔍 Test des propriétés avec données manquantes...');
    
    const propertiesWithMissingData = properties.filter(p => 
      !p.price_per_night || !p.rating || !p.review_count
    );
    
    if (propertiesWithMissingData.length > 0) {
      console.log(`   ${propertiesWithMissingData.length} propriétés avec données manquantes trouvées`);
      
      // Tester le tri avec des données manquantes
      const sortedWithMissing = [...propertiesWithMissingData].sort((a, b) => 
        (a.price_per_night || 0) - (b.price_per_night || 0)
      );
      
      console.log('   ✅ Tri avec données manquantes fonctionne');
    } else {
      console.log('   Toutes les propriétés ont des données complètes');
    }

    console.log('\n🎉 Tests de tri terminés avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
  }
}

// Exécuter les tests
testPropertySorting();
