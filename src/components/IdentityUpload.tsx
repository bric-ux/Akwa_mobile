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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { uploadIdentityDocument } = useIdentityVerification();

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Nous avons besoin de l\'accès à votre galerie pour télécharger votre pièce d\'identité.'
      );
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) {
      Alert.alert('Erreur', 'Veuillez sélectionner une image');
      return;
    }

    setUploading(true);

    try {
      // Pour React Native, nous devons créer un objet FormData
      const formData = new FormData();
      formData.append('file', {
        uri: selectedImage,
        type: 'image/jpeg',
        name: 'identity-document.jpg',
      } as any);

      // Utiliser directement l'URI avec Supabase
      const fileExt = 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `identity-documents/${fileName}`;

      // Upload vers Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(filePath, {
          uri: selectedImage,
          type: 'image/jpeg',
          name: fileName,
        } as any);

      if (uploadError) throw uploadError;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('property-images')
        .getPublicUrl(filePath);

      // Sauvegarder dans la base de données
      const { error: dbError } = await supabase
        .from('identity_documents')
        .insert({
          user_id: userId,
          document_type: documentType,
          document_url: publicUrl,
          verified: null // null = en attente de validation admin
        });

      if (dbError) throw dbError;
      
      Alert.alert(
        'Succès',
        'Votre pièce d\'identité a été téléchargée avec succès. Elle sera vérifiée par notre équipe.',
        [
          {
            text: 'OK',
            onPress: () => {
              setSelectedImage(null);
              onUploadSuccess?.();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Erreur upload:', error);
      Alert.alert('Erreur', error.message || 'Impossible de télécharger le document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Télécharger votre pièce d'identité</Text>
      <Text style={styles.subtitle}>
        Téléchargez une pièce d'identité valide (carte d'identité, passeport, ou permis de conduire).
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
        {selectedImage ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: selectedImage }} style={styles.image} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close-circle" size={24} color="#dc2626" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
            <Ionicons name="camera-outline" size={32} color="#666" />
            <Text style={styles.uploadButtonText}>Sélectionner une image</Text>
            <Text style={styles.uploadButtonSubtext}>Appuyez pour choisir une photo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bouton d'upload */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          (!selectedImage || uploading) && styles.submitButtonDisabled
        ]}
        onPress={handleUpload}
        disabled={!selectedImage || uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
            <Text style={styles.submitButtonText}>Télécharger le document</Text>
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
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
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
