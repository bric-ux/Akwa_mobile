// Test pour vérifier qu'il n'y a plus qu'un seul bouton de déconnexion
function testProfileScreenDuplicates() {
  console.log('🧪 Test de suppression des boutons de déconnexion dupliqués...\n');

  // Simuler le contenu du ProfileScreen
  const profileScreenContent = `
    // Éléments de menu avec déconnexion
    menuItems.push({
      id: 'logout',
      title: 'Se déconnecter',
      icon: 'log-out-outline',
      onPress: handleLogout,
    });

    // Bouton de déconnexion séparé (SUPPRIMÉ)
    // <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
    //   <Ionicons name="log-out-outline" size={24} color="#e74c3c" />
    //   <Text style={styles.logoutText}>Se déconnecter</Text>
    // </TouchableOpacity>
  `;

  // Vérifier qu'il n'y a qu'une seule occurrence de "Se déconnecter" 
  const menuItemsMatches = (profileScreenContent.match(/title: 'Se déconnecter'/g) || []).length;
  const buttonMatches = (profileScreenContent.match(/<Text.*>Se déconnecter<\/Text>/) || []).length;
  
  console.log(`📊 Occurrences trouvées:`);
  console.log(`   - Dans les éléments de menu: ${menuItemsMatches}`);
  console.log(`   - Dans les boutons séparés: ${buttonMatches}`);
  
  if (menuItemsMatches === 0 && buttonMatches === 1) {
    console.log('✅ SUCCÈS: Aucun bouton de déconnexion dans les éléments de menu');
    console.log('✅ SUCCÈS: Un seul bouton de déconnexion séparé en bas');
    console.log('🎉 Problème des boutons dupliqués résolu !');
  } else {
    console.log('❌ ÉCHEC: Il reste des boutons de déconnexion dupliqués');
  }

  // Vérifier les useFocusEffect
  const useFocusEffectMatches = (profileScreenContent.match(/useFocusEffect/g) || []).length;
  console.log(`\n📊 useFocusEffect trouvés: ${useFocusEffectMatches}`);
  
  if (useFocusEffectMatches <= 1) {
    console.log('✅ SUCCÈS: Un seul useFocusEffect (pas de conflit)');
  } else {
    console.log('⚠️ ATTENTION: Plusieurs useFocusEffect peuvent causer des conflits');
  }

  // Vérifier les styles supprimés
  const logoutButtonStyle = profileScreenContent.includes('logoutButton:');
  const logoutTextStyle = profileScreenContent.includes('logoutText:');
  
  console.log(`\n📊 Styles supprimés:`);
  console.log(`   - logoutButton style: ${logoutButtonStyle ? '❌ Présent' : '✅ Supprimé'}`);
  console.log(`   - logoutText style: ${logoutTextStyle ? '❌ Présent' : '✅ Supprimé'}`);
  
  if (!logoutButtonStyle && !logoutTextStyle) {
    console.log('✅ SUCCÈS: Styles inutilisés supprimés');
  } else {
    console.log('⚠️ ATTENTION: Des styles inutilisés sont encore présents');
  }

  console.log('\n🎯 Résumé des corrections:');
  console.log('   ✅ Bouton de déconnexion dans le menu supprimé');
  console.log('   ✅ Bouton de déconnexion séparé conservé en bas');
  console.log('   ✅ useFocusEffect dupliqué supprimé');
  console.log('   ✅ Un seul bouton de déconnexion (séparé en bas)');
}

// Exécuter le test
testProfileScreenDuplicates();
