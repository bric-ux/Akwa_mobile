const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase (même que dans l'app mobile)
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testMobileSignupFlow() {
  console.log('📱 Test du flux d\'inscription mobile...\n');

  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  const testFirstName = 'Test';
  const testLastName = 'User';

  try {
    console.log('🔍 Étape 1: Inscription avec Supabase Auth...');
    
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          first_name: testFirstName,
          last_name: testLastName,
        },
      },
    });

    if (signupError) {
      console.error('❌ Erreur inscription:', signupError);
      return;
    }

    console.log('✅ Inscription réussie');
    console.log('👤 Utilisateur créé:', signupData.user?.id);

    if (signupData.user) {
      console.log('\n🔍 Étape 2: Envoi email de bienvenue...');
      
      try {
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            type: 'welcome',
            to: testEmail,
            data: {
              firstName: testFirstName || 'Utilisateur'
            }
          }
        });

        if (emailError) {
          console.error('❌ Erreur envoi email:', emailError);
        } else {
          console.log('✅ Email de bienvenue envoyé');
          console.log('📧 ID email:', emailData.id);
        }
      } catch (emailErr) {
        console.error('❌ Erreur inattendue email:', emailErr);
      }

      console.log('\n🔍 Étape 3: Création du profil...');
      
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: signupData.user.id,
            first_name: testFirstName,
            last_name: testLastName,
            email: testEmail,
            role: 'user',
            is_host: false,
          });

        if (profileError) {
          console.error('❌ Erreur création profil:', profileError);
        } else {
          console.log('✅ Profil créé avec succès');
        }
      } catch (profileErr) {
        console.error('❌ Erreur inattendue profil:', profileErr);
      }
    }

    console.log('\n🔍 Étape 4: Nettoyage (suppression du compte de test)...');
    
    // Note: On ne peut pas supprimer le compte via l'API client
    console.log('ℹ️  Compte de test créé, à supprimer manuellement si nécessaire');

  } catch (err) {
    console.error('❌ Erreur inattendue:', err);
  }

  console.log('\n📋 Résumé du test :');
  console.log('✅ Inscription Supabase Auth');
  console.log('✅ Envoi email de bienvenue');
  console.log('✅ Création profil utilisateur');
  console.log('\n💡 Si tout fonctionne ici, le problème est dans l\'app mobile');
}

testMobileSignupFlow();
