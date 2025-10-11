const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testProfilePhotoUpload() {
  try {
    console.log('🧪 Test d\'upload de photo de profil avec authentification...\n');
    
    // 1. Créer un utilisateur de test ou utiliser un existant
    console.log('1. Connexion avec un utilisateur de test...');
    
    // Pour ce test, nous allons utiliser l'email/mot de passe d'un utilisateur existant
    // Remplacez par vos vraies informations de test
    const testEmail = 'test@example.com'; // Remplacez par un email de test
    const testPassword = 'testpassword123'; // Remplacez par un mot de passe de test
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (authError) {
      console.log('❌ Erreur d\'authentification:', authError.message);
      console.log('   Créons un utilisateur de test...');
      
      // Créer un utilisateur de test
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: {
            first_name: 'Test',
            last_name: 'User'
          }
        }
      });
      
      if (signUpError) {
        console.log('❌ Impossible de créer l\'utilisateur de test:', signUpError.message);
        return;
      }
      
      console.log('✅ Utilisateur de test créé:', signUpData.user?.id);
    } else {
      console.log('✅ Connexion réussie:', authData.user?.id);
    }
    
    // 2. Obtenir l'utilisateur actuel
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('❌ Aucun utilisateur connecté');
      return;
    }
    
    console.log('   Utilisateur ID:', user.id);
    console.log('   Email:', user.email);
    
    // 3. Test d'upload d'une photo de profil
    console.log('\n2. Test d\'upload de photo de profil...');
    
    // Créer un contenu d'image simulé (en base64)
    const testImageContent = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A';
    
    // Convertir en blob
    const response = await fetch(testImageContent);
    const blob = await response.blob();
    
    const fileName = `avatar-test-${Date.now()}.jpg`;
    const filePath = `${user.id}/${fileName}`;
    
    console.log('   Chemin de fichier:', filePath);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true
      });
    
    if (uploadError) {
      console.log('❌ Erreur d\'upload:', uploadError.message);
      console.log('   Détails:', uploadError);
      
      // Vérifier si c'est un problème de politique RLS
      if (uploadError.message.includes('row-level security')) {
        console.log('\n🔧 Solution: Exécutez le script SQL setup-profile-photos-rls-complete.sql dans Supabase Dashboard');
      }
    } else {
      console.log('✅ Upload réussi!');
      console.log('   Chemin:', uploadData.path);
      
      // Obtenir l'URL publique
      const { data: urlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(uploadData.path);
      
      console.log('   URL publique:', urlData.publicUrl);
      
      // 4. Vérifier que le fichier est bien accessible
      console.log('\n3. Vérification de l\'accessibilité...');
      
      const { data: fileData, error: fileError } = await supabase.storage
        .from('profile-photos')
        .download(uploadData.path);
      
      if (fileError) {
        console.log('❌ Impossible de télécharger le fichier:', fileError.message);
      } else {
        console.log('✅ Fichier accessible et téléchargeable');
        console.log('   Taille:', fileData.size, 'bytes');
      }
      
      // 5. Nettoyer le fichier de test
      console.log('\n4. Nettoyage du fichier de test...');
      
      const { error: deleteError } = await supabase.storage
        .from('profile-photos')
        .remove([uploadData.path]);
      
      if (deleteError) {
        console.log('⚠️ Impossible de supprimer le fichier de test:', deleteError.message);
      } else {
        console.log('✅ Fichier de test supprimé');
      }
    }
    
    // 6. Déconnexion
    console.log('\n5. Déconnexion...');
    await supabase.auth.signOut();
    console.log('✅ Déconnexion réussie');
    
  } catch (err) {
    console.error('Erreur générale:', err);
  }
}

// Exécuter le test
testProfilePhotoUpload();

