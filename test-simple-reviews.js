console.log('🧪 Test simple des avis...\n');

console.log('📋 Étapes de debug :');
console.log('1. Ouvrir l\'application mobile');
console.log('2. Aller sur une page de propriété avec des avis');
console.log('3. Regarder les logs dans la console');
console.log('4. Vérifier les messages suivants :');
console.log('   - "🔄 Chargement des profils reviewers..."');
console.log('   - "🔍 Reviews reçues: [...]"');
console.log('   - "🔍 Reviewer IDs extraits: [...]"');
console.log('   - "🔍 Données profiles récupérées: [...]"');
console.log('   - "✅ Profils reviewers chargés: {...}"');

console.log('\n🔍 Si vous voyez "Anonyme" :');
console.log('- Vérifiez que les reviewer_id ne sont pas null/undefined');
console.log('- Vérifiez que les profils existent dans la table profiles');
console.log('- Vérifiez que la relation reviewer_id -> user_id fonctionne');

console.log('\n✅ Prêt pour le debug !');

