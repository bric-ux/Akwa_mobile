import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const TermsScreen: React.FC = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conditions d'utilisation</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.paragraph}>
          En accédant à AkwaHome, vous acceptez les présentes conditions. Merci de les lire attentivement.
        </Text>

        <Text style={styles.sectionTitle}>1. Objet du service</Text>
        <Text style={styles.paragraph}>
          AkwaHome met en relation des hôtes et des voyageurs pour la location de logements. Nous ne sommes pas
          partie aux contrats conclus entre hôtes et voyageurs, qui restent seuls responsables des obligations
          légales et fiscales associées.
        </Text>

        <Text style={styles.sectionTitle}>2. Comptes</Text>
        <Text style={styles.paragraph}>
          Vous êtes responsable de l'exactitude des informations fournies, de la confidentialité de vos identifiants
          et de l'utilisation de votre compte. Nous pouvons suspendre ou résilier un compte en cas de non-respect
          des présentes conditions ou de comportement frauduleux.
        </Text>

        <Text style={styles.sectionTitle}>3. Réservations et paiements</Text>
        <Text style={styles.paragraph}>
          Les conditions d'annulation, de remboursement et les frais applicables sont indiqués lors de la
          réservation. Les paiements sont gérés via des prestataires de paiement sécurisés. Les hôtes doivent
          fournir des informations de paiement valides pour recevoir leurs revenus.
        </Text>

        <Text style={styles.sectionTitle}>4. Règles et sécurité</Text>
        <Text style={styles.paragraph}>
          Les hôtes doivent proposer des logements conformes, sûrs et décrits fidèlement. Les voyageurs s'engagent
          à respecter le logement, le voisinage et les règles de la maison.
        </Text>

        <Text style={styles.sectionTitle}>5. Responsabilité</Text>
        <Text style={styles.paragraph}>
          AkwaHome ne peut être tenu responsable des dommages indirects, pertes de profits, ou incidents survenant
          entre hôtes et voyageurs. Notre responsabilité, si elle est engagée, est limitée aux montants versés par
          l'utilisateur dans les 12 derniers mois.
        </Text>

        <Text style={styles.sectionTitle}>6. Contenu</Text>
        <Text style={styles.paragraph}>
          Vous garantissez disposer des droits nécessaires pour publier tout contenu (photos, descriptions, avis) et
          concédez à AkwaHome une licence non exclusive pour l'exploiter aux fins du service.
        </Text>

        <Text style={styles.sectionTitle}>7. Données personnelles</Text>
        <Text style={styles.paragraph}>
          Le traitement de vos données est régi par notre Politique de confidentialité. En utilisant AkwaHome,
          vous consentez à ce traitement.
        </Text>

        <Text style={styles.sectionTitle}>8. Modifications</Text>
        <Text style={styles.paragraph}>
          Nous pouvons modifier ces conditions. Vous serez informé des changements significatifs. L'utilisation
          continue du service vaut acceptation des nouvelles conditions.
        </Text>

        <Text style={styles.sectionTitle}>9. Droit applicable</Text>
        <Text style={styles.paragraph}>
          Ces conditions sont régies par le droit applicable dans le pays d'exploitation d'AkwaHome. Tout litige
          relève des tribunaux compétents du même ressort.
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

export default TermsScreen;


