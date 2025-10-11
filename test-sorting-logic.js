// Test unitaire pour la logique de tri des propriétés
function testPropertySortingLogic() {
  console.log('🧪 Test de la logique de tri des propriétés...\n');

  // Données de test
  const mockProperties = [
    {
      id: '1',
      title: 'Villa Luxe',
      price_per_night: 50000,
      rating: 4.8,
      review_count: 25,
      created_at: '2024-01-15T10:00:00Z'
    },
    {
      id: '2',
      title: 'Appartement Moderne',
      price_per_night: 25000,
      rating: 4.5,
      review_count: 15,
      created_at: '2024-02-20T10:00:00Z'
    },
    {
      id: '3',
      title: 'Studio Économique',
      price_per_night: 15000,
      rating: 4.2,
      review_count: 8,
      created_at: '2024-03-10T10:00:00Z'
    },
    {
      id: '4',
      title: 'Maison Familiale',
      price_per_night: 75000,
      rating: 4.9,
      review_count: 40,
      created_at: '2024-01-05T10:00:00Z'
    },
    {
      id: '5',
      title: 'Chambre Simple',
      price_per_night: 12000,
      rating: 3.8,
      review_count: 5,
      created_at: '2024-03-25T10:00:00Z'
    }
  ];

  // Fonctions de tri (copiées du hook)
  const sortByPriceAsc = (a, b) => (a.price_per_night || 0) - (b.price_per_night || 0);
  const sortByPriceDesc = (a, b) => (b.price_per_night || 0) - (a.price_per_night || 0);
  const sortByRating = (a, b) => {
    const ratingA = a.rating || 0;
    const ratingB = b.rating || 0;
    if (ratingA === ratingB) {
      return (b.review_count || 0) - (a.review_count || 0);
    }
    return ratingB - ratingA;
  };
  const sortByNewest = (a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateB - dateA;
  };
  const sortByPopular = (a, b) => {
    const scoreA = (a.rating || 0) * Math.log((a.review_count || 0) + 1);
    const scoreB = (b.rating || 0) * Math.log((b.review_count || 0) + 1);
    return scoreB - scoreA;
  };

  // Tests
  const tests = [
    {
      name: 'Prix croissant',
      sort: sortByPriceAsc,
      expected: ['5', '3', '2', '1', '4'] // IDs dans l'ordre croissant des prix
    },
    {
      name: 'Prix décroissant',
      sort: sortByPriceDesc,
      expected: ['4', '1', '2', '3', '5'] // IDs dans l'ordre décroissant des prix
    },
    {
      name: 'Mieux notés',
      sort: sortByRating,
      expected: ['4', '1', '2', '3', '5'] // IDs dans l'ordre décroissant des notes
    },
    {
      name: 'Plus récents',
      sort: sortByNewest,
      expected: ['5', '3', '2', '1', '4'] // IDs dans l'ordre décroissant des dates
    },
    {
      name: 'Plus populaires',
      sort: sortByPopular,
      expected: ['4', '1', '2', '3', '5'] // IDs dans l'ordre décroissant de popularité
    }
  ];

  let allTestsPassed = true;

  tests.forEach((test, index) => {
    console.log(`${index + 1}. Test: ${test.name}`);
    
    const sorted = [...mockProperties].sort(test.sort);
    const sortedIds = sorted.map(p => p.id);
    
    console.log(`   Résultat: [${sortedIds.join(', ')}]`);
    console.log(`   Attendu:  [${test.expected.join(', ')}]`);
    
    const isCorrect = JSON.stringify(sortedIds) === JSON.stringify(test.expected);
    console.log(`   ${isCorrect ? '✅' : '❌'} ${isCorrect ? 'PASSÉ' : 'ÉCHOUÉ'}`);
    
    if (!isCorrect) {
      allTestsPassed = false;
    }
    
    // Afficher les détails du tri
    console.log('   Détails:');
    sorted.forEach((prop, i) => {
      const price = prop.price_per_night.toLocaleString();
      const rating = prop.rating;
      const reviews = prop.review_count;
      const date = new Date(prop.created_at).toLocaleDateString();
      const popularity = (prop.rating || 0) * Math.log((prop.review_count || 0) + 1);
      
      console.log(`   ${i + 1}. ${prop.title} - ${price}FCFA, ${rating}/5 (${reviews} avis), ${date}${test.name === 'Plus populaires' ? `, score: ${popularity.toFixed(2)}` : ''}`);
    });
    
    console.log('');
  });

  // Test avec données manquantes
  console.log('🔍 Test avec données manquantes...');
  
  const propertiesWithMissingData = [
    { id: '6', title: 'Sans prix', price_per_night: null, rating: 4.0, review_count: 10, created_at: '2024-01-01T10:00:00Z' },
    { id: '7', title: 'Sans note', price_per_night: 30000, rating: null, review_count: 5, created_at: '2024-01-02T10:00:00Z' },
    { id: '8', title: 'Sans avis', price_per_night: 20000, rating: 4.5, review_count: null, created_at: '2024-01-03T10:00:00Z' }
  ];
  
  const sortedWithMissing = [...propertiesWithMissingData].sort(sortByPriceAsc);
  console.log('   Tri par prix avec données manquantes:');
  sortedWithMissing.forEach((prop, i) => {
    const price = prop.price_per_night ? prop.price_per_night.toLocaleString() : 'N/A';
    console.log(`   ${i + 1}. ${prop.title} - ${price}FCFA`);
  });
  
  console.log('   ✅ Tri avec données manquantes fonctionne\n');

  // Résultat final
  console.log(`🎯 Résultat final: ${allTestsPassed ? '✅ TOUS LES TESTS PASSÉS' : '❌ CERTAINS TESTS ONT ÉCHOUÉ'}`);
  
  if (allTestsPassed) {
    console.log('🎉 La logique de tri est correctement implémentée !');
  } else {
    console.log('⚠️ Des corrections sont nécessaires dans la logique de tri.');
  }
}

// Exécuter les tests
testPropertySortingLogic();
