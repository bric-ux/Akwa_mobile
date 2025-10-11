// Test rapide de la relation propriétés-avis

function testPropertyReviewsRelation() {
  console.log('🧪 Test rapide de la relation propriétés-avis...\n');

  console.log('✅ PROBLÈME IDENTIFIÉ:');
  console.log('   - Propriété affiche 5.0 et 0 avis');
  console.log('   - Impossible si il y a 1 avis en base');
  console.log('   - Les avis ne sont pas récupérés\n');

  console.log('🔍 DIAGNOSTIC POSSIBLE:');
  console.log('   1. La relation SQL ne fonctionne pas');
  console.log('   2. Les avis ne sont pas dans la table reviews');
  console.log('   3. Le property_id ne correspond pas');
  console.log('   4. La requête Supabase a un problème\n');

  console.log('🧪 INSTRUCTIONS DE TEST:');
  console.log('1. Ouvrir l\'écran de recherche');
  console.log('2. Faire une recherche');
  console.log('3. Chercher la propriété "haut standing"');
  console.log('4. Vérifier les logs de debug détaillés');
  console.log('5. Regarder:');
  console.log('   - propertyId: ID de la propriété');
  console.log('   - reviews: tableau des avis');
  console.log('   - hasReviewsProperty: si la propriété reviews existe');
  console.log('   - reviewsType: type de la propriété reviews');
  console.log('   - reviewsIsArray: si c\'est un tableau');

  console.log('\n🎯 DIAGNOSTIC EN COURS !');
  console.log('   Les logs détaillés vont révéler le problème !');
}

// Exécuter le test
testPropertyReviewsRelation();
