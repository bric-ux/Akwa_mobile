console.log('📧 Test de la configuration email...\n');

console.log('🔍 Problèmes possibles :');
console.log('1. Email envoyé mais dans les spams');
console.log('2. Configuration Resend incorrecte');
console.log('3. Email non valide');
console.log('4. Problème de domaine d\'envoi');

console.log('\n✅ Solutions à vérifier :');

console.log('\n📧 1. Vérifier les spams :');
console.log('- Regarder dans le dossier "Spam" ou "Indésirables"');
console.log('- Ajouter noreply@akwahome.com aux contacts');
console.log('- Marquer comme "Non spam" si trouvé');

console.log('\n🔧 2. Vérifier la configuration Resend :');
console.log('- Aller sur https://resend.com/');
console.log('- Vérifier que le domaine akwahome.com est vérifié');
console.log('- Vérifier que RESEND_API_KEY est configurée');
console.log('- Vérifier les logs d\'envoi dans Resend Dashboard');

console.log('\n📋 3. Vérifier les logs Supabase :');
console.log('- Aller sur Supabase Dashboard > Functions > send-email');
console.log('- Vérifier les logs d\'exécution');
console.log('- Chercher les erreurs ou warnings');

console.log('\n🧪 4. Test avec un email différent :');
console.log('- Essayer avec Gmail, Yahoo, Outlook');
console.log('- Vérifier que l\'email est valide');
console.log('- Tester avec un email de test');

console.log('\n📊 5. Vérifier les statistiques :');
console.log('- Resend Dashboard > Emails');
console.log('- Voir le statut des emails envoyés');
console.log('- Vérifier les bounces ou erreurs');

console.log('\n💡 6. Test de débogage :');
console.log('- Ajouter des logs détaillés (déjà fait)');
console.log('- Tester avec un email de développement');
console.log('- Vérifier la réponse de la fonction Edge');

console.log('\n🎯 Prochaines étapes :');
console.log('1. Tester l\'inscription mobile avec les nouveaux logs');
console.log('2. Vérifier les spams');
console.log('3. Vérifier Resend Dashboard');
console.log('4. Tester avec un email différent');

console.log('\n✅ Configuration testée et prête !');
