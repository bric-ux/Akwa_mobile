const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPropertiesVisibility() {
  try {
    console.log('🔍 Vérification de la visibilité des propriétés...\n');

    // 1. Vérifier toutes les propriétés avec leur statut
    console.log('📊 Statut de toutes les propriétés...');
    
    const { data: allProperties, error: allError } = await supabase
      .from('properties')
      .select('id, title, is_active, is_hidden, created_at')
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('❌ Erreur lors de la récupération des propriétés:', allError);
      return;
    }

    console.log(`✅ ${allProperties.length} propriété(s) trouvée(s)`);
    
    // Statistiques par statut
    const stats = {
      total: allProperties.length,
      active: allProperties.filter(p => p.is_active).length,
      inactive: allProperties.filter(p => !p.is_active).length,
      visible: allProperties.filter(p => !p.is_hidden).length,
      hidden: allProperties.filter(p => p.is_hidden).length,
      activeAndVisible: allProperties.filter(p => p.is_active && !p.is_hidden).length,
    };

    console.log('\n📈 Statistiques:');
    console.log(`   - Total: ${stats.total}`);
    console.log(`   - Actives: ${stats.active}`);
    console.log(`   - Inactives: ${stats.inactive}`);
    console.log(`   - Visibles: ${stats.visible}`);
    console.log(`   - Masquées: ${stats.hidden}`);
    console.log(`   - Actives ET visibles: ${stats.activeAndVisible}`);

    // 2. Propriétés qui devraient s'afficher à l'accueil
    console.log('\n🏠 Propriétés qui devraient s\'afficher à l\'accueil:');
    const visibleProperties = allProperties.filter(p => p.is_active && !p.is_hidden);
    
    if (visibleProperties.length > 0) {
      visibleProperties.forEach((property, index) => {
        console.log(`   ${index + 1}. ${property.title}`);
        console.log(`      - ID: ${property.id}`);
        console.log(`      - Active: ${property.is_active}`);
        console.log(`      - Masquée: ${property.is_hidden}`);
        console.log(`      - Date: ${new Date(property.created_at).toLocaleDateString('fr-FR')}`);
        console.log('');
      });
    } else {
      console.log('   ⚠️ Aucune propriété visible trouvée');
    }

    // 3. Propriétés masquées qui ne devraient PAS s'afficher
    console.log('🚫 Propriétés masquées (ne devraient PAS s\'afficher):');
    const hiddenProperties = allProperties.filter(p => p.is_hidden);
    
    if (hiddenProperties.length > 0) {
      hiddenProperties.forEach((property, index) => {
        console.log(`   ${index + 1}. ${property.title}`);
        console.log(`      - ID: ${property.id}`);
        console.log(`      - Active: ${property.is_active}`);
        console.log(`      - Masquée: ${property.is_hidden}`);
        console.log(`      - Date: ${new Date(property.created_at).toLocaleDateString('fr-FR')}`);
        console.log('');
      });
    } else {
      console.log('   ✅ Aucune propriété masquée');
    }

    // 4. Test de la requête utilisée par l'app
    console.log('🔍 Test de la requête utilisée par l\'application...');
    
    const { data: appQuery, error: appError } = await supabase
      .from('properties')
      .select(`
        id,
        title,
        is_active,
        is_hidden,
        cities:city_id (
          id,
          name,
          region
        )
      `)
      .eq('is_active', true)
      .eq('is_hidden', false)
      .order('price_per_night', { ascending: true })
      .limit(50);

    if (appError) {
      console.error('❌ Erreur lors de la requête app:', appError);
    } else {
      console.log(`✅ Requête app retourne ${appQuery.length} propriété(s)`);
      
      if (appQuery.length > 0) {
        console.log('\n📋 Propriétés retournées par l\'app:');
        appQuery.forEach((property, index) => {
          console.log(`   ${index + 1}. ${property.title}`);
          console.log(`      - Ville: ${property.cities?.name || 'Non définie'}`);
          console.log(`      - Active: ${property.is_active}`);
          console.log(`      - Masquée: ${property.is_hidden}`);
          console.log('');
        });
      }
    }

    // 5. Vérifier s'il y a des propriétés masquées qui apparaissent quand même
    console.log('⚠️ Vérification des propriétés masquées qui apparaissent...');
    
    const hiddenButActive = allProperties.filter(p => p.is_hidden && p.is_active);
    if (hiddenButActive.length > 0) {
      console.log(`❌ ${hiddenButActive.length} propriété(s) masquée(s) mais active(s):`);
      hiddenButActive.forEach((property, index) => {
        console.log(`   ${index + 1}. ${property.title} (ID: ${property.id})`);
      });
    } else {
      console.log('✅ Aucune propriété masquée mais active');
    }

    console.log('\n✅ Vérification terminée !');

  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
  }
}

// Exécuter la vérification
checkPropertiesVisibility();


