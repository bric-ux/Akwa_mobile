import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const PrivacyPolicyScreen: React.FC = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Politique de confidentialité</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.paragraph}>
          Nous accordons une grande importance à la protection de vos données personnelles. Cette
          politique explique quelles informations nous collectons, comment nous les utilisons et vos droits.
        </Text>

        <Text style={styles.sectionTitle}>1. Données collectées</Text>
        <Text style={styles.paragraph}>
          Nous collectons les informations que vous nous fournissez (nom, email, téléphone, informations de
          paiement des hôtes, préférences), ainsi que des données techniques (adresse IP, identifiants d'appareil,
          logs d'utilisation) pour assurer le bon fonctionnement du service.
        </Text>

        <Text style={styles.sectionTitle}>2. Finalités</Text>
        <Text style={styles.paragraph}>
          Vos données sont utilisées pour: (i) créer et gérer votre compte; (ii) traiter les réservations; (iii)
          communiquer avec vous; (iv) prévenir la fraude et assurer la sécurité; (v) respecter nos obligations
          légales; (vi) améliorer nos services et l'expérience utilisateur.
        </Text>

        <Text style={styles.sectionTitle}>3. Partage des données</Text>
        <Text style={styles.paragraph}>
          Nous ne vendons pas vos données. Nous pouvons partager des informations avec des prestataires de services
          (paiement, emailing, hébergement, analytique) strictement nécessaires à l'exécution du service et soumis
          à des obligations de confidentialité. Certaines données peuvent être partagées avec les hôtes/voyageurs
          dans le cadre des réservations.
        </Text>

        <Text style={styles.sectionTitle}>4. Conservation</Text>
        <Text style={styles.paragraph}>
          Les données sont conservées pendant la durée nécessaire aux finalités décrites et pour répondre aux
          exigences légales (facturation, comptabilité, litiges), puis supprimées ou anonymisées.
        </Text>

        <Text style={styles.sectionTitle}>5. Sécurité</Text>
        <Text style={styles.paragraph}>
          Nous mettons en place des mesures techniques et organisationnelles appropriées pour protéger vos données
          (chiffrement en transit, contrôle d'accès, journalisation). Aucune mesure n'étant infaillible, nous vous
          recommandons de conserver des mots de passe forts et uniques.
        </Text>

        <Text style={styles.sectionTitle}>6. Vos droits</Text>
        <Text style={styles.paragraph}>
          Vous pouvez demander l'accès, la rectification, la suppression, la limitation ou l'opposition au
          traitement de vos données, ainsi que la portabilité, dans les limites prévues par la loi. Contact:
          privacy@akwahome.com.
        </Text>

        <Text style={styles.sectionTitle}>7. Cookies et traceurs</Text>
        <Text style={styles.paragraph}>
          Nous utilisons des traceurs pour des fins techniques, analytiques et d'amélioration du service. Vous pouvez
          configurer votre appareil pour limiter certains traceurs.
        </Text>

        <Text style={styles.sectionTitle}>8. Transferts</Text>
        <Text style={styles.paragraph}>
          Si des données sont transférées hors de votre pays, nous veillons à ce que des garanties appropriées
          soient en place conformément à la réglementation applicable.
        </Text>

        <Text style={styles.sectionTitle}>9. Contact</Text>
        <Text style={styles.paragraph}>
          Pour toute question ou demande concernant cette politique, contactez-nous à privacy@akwahome.com.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e9ecef'
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  placeholder: { width: 40 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginTop: 16, marginBottom: 8 },
  paragraph: { fontSize: 14, color: '#374151', lineHeight: 20 },
});

export default PrivacyPolicyScreen;





