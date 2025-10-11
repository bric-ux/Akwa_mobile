const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testHostApplicationsManagement() {
  try {
    console.log('🔍 Test de la gestion des candidatures d\'hôte...\n');

    // 1. Vérifier la table host_applications
    console.log('📋 Test de la table host_applications...');
    
    const { data: applications, error: applicationsError } = await supabase
      .from('host_applications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (applicationsError) {
      console.error('❌ Erreur lors de la récupération des candidatures:', applicationsError);
      return;
    }

    console.log(`✅ Table host_applications accessible - ${applications.length} candidature(s) trouvée(s)`);
    
    if (applications.length > 0) {
      console.log('\n📊 Détails des candidatures:');
      applications.forEach((app, index) => {
        console.log(`   ${index + 1}. ${app.title} (${app.status})`);
        console.log(`      - Hôte: ${app.full_name} (${app.email})`);
        console.log(`      - Type: ${app.property_type} à ${app.location}`);
        console.log(`      - Prix: ${app.price_per_night} XOF/nuit`);
        console.log(`      - Capacité: ${app.max_guests} voyageurs`);
        console.log(`      - Date: ${new Date(app.created_at).toLocaleDateString('fr-FR')}`);
        if (app.admin_notes) {
          console.log(`      - Notes admin: ${app.admin_notes}`);
        }
        console.log('');
      });
    }

    // 2. Vérifier la table identity_documents
    console.log('🆔 Test de la table identity_documents...');
    
    const { data: identityDocs, error: identityError } = await supabase
      .from('identity_documents')
      .select('*')
      .limit(3);

    if (identityError) {
      console.error('❌ Erreur lors de la récupération des documents d\'identité:', identityError);
    } else {
      console.log(`✅ Table identity_documents accessible - ${identityDocs.length} document(s) trouvé(s)`);
      
      if (identityDocs.length > 0) {
        console.log('\n📄 Détails des documents:');
        identityDocs.forEach((doc, index) => {
          console.log(`   ${index + 1}. Type: ${doc.document_type}`);
          console.log(`      - Numéro: ${doc.document_number}`);
          console.log(`      - Utilisateur: ${doc.user_id}`);
          console.log(`      - Images: ${doc.front_image_url ? 'Recto ✓' : 'Recto ✗'} | ${doc.back_image_url ? 'Verso ✓' : 'Verso ✗'}`);
          console.log('');
        });
      }
    }

    // 3. Vérifier les statistiques par statut
    console.log('📊 Statistiques par statut des candidatures...');
    
    const statusCounts = {
      pending: 0,
      reviewing: 0,
      approved: 0,
      rejected: 0
    };

    applications.forEach(app => {
      if (statusCounts.hasOwnProperty(app.status)) {
        statusCounts[app.status]++;
      }
    });

    console.log('   - En attente:', statusCounts.pending);
    console.log('   - En révision:', statusCounts.reviewing);
    console.log('   - Approuvées:', statusCounts.approved);
    console.log('   - Refusées:', statusCounts.rejected);

    // 4. Vérifier la table profiles pour les hôtes
    console.log('\n👥 Test de la table profiles (hôtes)...');
    
    const { data: hosts, error: hostsError } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, email, is_host, role')
      .eq('is_host', true)
      .limit(5);

    if (hostsError) {
      console.error('❌ Erreur lors de la récupération des hôtes:', hostsError);
    } else {
      console.log(`✅ Table profiles accessible - ${hosts.length} hôte(s) trouvé(s)`);
      
      if (hosts.length > 0) {
        console.log('\n🏠 Détails des hôtes:');
        hosts.forEach((host, index) => {
          console.log(`   ${index + 1}. ${host.first_name} ${host.last_name} (${host.email})`);
          console.log(`      - Rôle: ${host.role}`);
          console.log(`      - Hôte: ${host.is_host ? 'Oui' : 'Non'}`);
          console.log('');
        });
      }
    }

    // 5. Test de la fonction d'envoi d'email (simulation)
    console.log('📧 Test de la fonction d\'envoi d\'email...');
    
    try {
      // Simuler un appel à la fonction send-email
      const testEmailData = {
        type: 'host_application_approved',
        to: 'test@example.com',
        data: {
          hostName: 'Test Host',
          propertyTitle: 'Test Property',
          propertyType: 'apartment',
          location: 'Abidjan'
        }
      };

      console.log('✅ Structure d\'email de test créée:', testEmailData);
      console.log('ℹ️  Note: L\'envoi réel nécessite une authentification admin');
    } catch (emailError) {
      console.error('❌ Erreur lors du test d\'email:', emailError);
    }

    // 6. Vérifier les permissions RLS
    console.log('\n🔒 Test des permissions RLS...');
    
    // Test de lecture anonyme (devrait échouer)
    const { data: anonymousData, error: anonymousError } = await supabase
      .from('host_applications')
      .select('id')
      .limit(1);

    if (anonymousError) {
      console.log('✅ RLS fonctionne - Accès anonyme refusé');
    } else {
      console.log('⚠️  RLS pourrait ne pas être configuré correctement');
    }

    console.log('\n✅ Test de la gestion des candidatures d\'hôte terminé avec succès !');

  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
  }
}

// Exécuter le test
testHostApplicationsManagement();

