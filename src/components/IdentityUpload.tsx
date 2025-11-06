import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import { supabase } from '../services/supabase';

interface IdentityUploadProps {
  userId: string;
  onUploadSuccess?: () => void;
}

const DOCUMENT_TYPES = [
  { value: 'cni', label: 'Carte Nationale d\'Identité' },
  { value: 'passport', label: 'Passeport' },
  { value: 'driving_license', label: 'Permis de Conduire' },
];

export const IdentityUpload: React.FC<IdentityUploadProps> = ({ 
  userId, 
  onUploadSuccess 
}) => {
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState('cni');
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    type: string;
    name: string;
    size?: number;
  } | null>(null);
  const { uploadIdentityDocument, checkIdentityStatus } = useIdentityVerification();

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Nous avons besoin de l\'accès à votre galerie pour envoyer votre pièce d\'identité.'
      );
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          type: 'image/jpeg',
          name: `identity-document-${Date.now()}.jpg`,
          size: asset.fileSize
        });
      }
    } catch (error) {
      console.error('Erreur lors de la sélection d\'image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          type: asset.mimeType || 'application/pdf',
          name: asset.name,
          size: asset.size
        });
      }
    } catch (error) {
      console.error('Erreur lors de la sélection de document:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner le document');
    }
  };

  const showFilePicker = () => {
    Alert.alert(
      'Sélectionner un fichier',
      'Choisissez le type de fichier à envoyer',
      [
        {
          text: 'Annuler',
          style: 'cancel'
        },
        {
          text: 'Photo',
          onPress: pickImage
        },
        {
          text: 'PDF',
          onPress: pickDocument
        }
      ]
    );
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert('Erreur', 'Veuillez sélectionner un fichier');
      return;
    }

    // Vérifier la taille du fichier (max 5MB)
    if (selectedFile.size && selectedFile.size > 5 * 1024 * 1024) {
      Alert.alert('Erreur', 'Le fichier ne doit pas dépasser 5MB');
      return;
    }

    setUploading(true);

    try {
      // Créer un objet File compatible avec la fonction du hook
      const file = {
        uri: selectedFile.uri,
        type: selectedFile.type,
        name: selectedFile.name,
        size: selectedFile.size
      };

      // Utiliser la fonction du hook qui gère tout automatiquement
      await uploadIdentityDocument(file, documentType);
      
      Alert.alert(
        'Succès',
        'Votre pièce d\'identité a été envoyée avec succès. Elle sera vérifiée par notre équipe.',
        [
          {
            text: 'OK',
            onPress: () => {
              setSelectedFile(null);
              // Mettre à jour le statut de vérification
              checkIdentityStatus(true);
              onUploadSuccess?.();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Erreur upload:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'envoyer le document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Envoyer votre pièce d'identité</Text>
      <Text style={styles.subtitle}>
        Envoyez une pièce d'identité valide (carte d'identité, passeport, ou permis de conduire).
      </Text>

      {/* Sélection du type de document */}
      <View style={styles.section}>
        <Text style={styles.label}>Type de document</Text>
        <View style={styles.documentTypes}>
          {DOCUMENT_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.documentTypeButton,
                documentType === type.value && styles.documentTypeButtonSelected
              ]}
              onPress={() => setDocumentType(type.value)}
            >
              <Text style={[
                styles.documentTypeText,
                documentType === type.value && styles.documentTypeTextSelected
              ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Sélection d'image */}
      <View style={styles.section}>
        <Text style={styles.label}>Document</Text>
        {selectedFile ? (
          <View style={styles.fileContainer}>
            {selectedFile.type.includes('image') ? (
              <Image source={{ uri: selectedFile.uri }} style={styles.image} />
            ) : (
              <View style={styles.pdfContainer}>
                <Ionicons name="document-text-outline" size={48} color="#ef4444" />
                <Text style={styles.pdfText}>{selectedFile.name}</Text>
                <Text style={styles.pdfSize}>
                  {selectedFile.size ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB` : 'PDF'}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => setSelectedFile(null)}
            >
              <Ionicons name="close-circle" size={24} color="#dc2626" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadButton} onPress={showFilePicker}>
            <Ionicons name="add-circle-outline" size={32} color="#666" />
            <Text style={styles.uploadButtonText}>Sélectionner un fichier</Text>
            <Text style={styles.uploadButtonSubtext}>Photo ou PDF (max 5MB)</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bouton d'upload */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          (!selectedFile || uploading) && styles.submitButtonDisabled
        ]}
        onPress={handleUpload}
        disabled={!selectedFile || uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
            <Text style={styles.submitButtonText}>Envoyer le document</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>Instructions :</Text>
        <Text style={styles.instructionsText}>
          • Assurez-vous que le document est bien visible et lisible{'\n'}
          • Évitez les reflets et les ombres{'\n'}
          • Le document doit être valide et non expiré{'\n'}
          • Formats acceptés : JPG, PNG, PDF (max 5MB)
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginVertical: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 10,
  },
  documentTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  documentTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  documentTypeButtonSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  documentTypeText: {
    fontSize: 14,
    color: '#374151',
  },
  documentTypeTextSelected: {
    color: '#fff',
  },
  imageContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  fileContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  pdfContainer: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pdfText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
  pdfSize: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginTop: 10,
  },
  uploadButtonSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  instructions: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 15,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
  },
});

export default IdentityUpload;
