import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReviewResponses } from '../hooks/useReviewResponses';
import { useLanguage } from '../contexts/LanguageContext';

interface ReviewResponseModalProps {
  visible: boolean;
  onClose: () => void;
  reviewId: string;
  existingResponse?: string | null;
  onResponseSubmitted: () => void;
}

const ReviewResponseModal: React.FC<ReviewResponseModalProps> = ({
  visible,
  onClose,
  reviewId,
  existingResponse,
  onResponseSubmitted,
}) => {
  const { t } = useLanguage();
  const { submitResponse, updateResponse, deleteResponse, loading } = useReviewResponses();
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    if (visible) {
      setResponseText(existingResponse || '');
    }
  }, [visible, existingResponse]);

  const handleSubmit = async () => {
    if (!responseText.trim()) {
      Alert.alert(
        t('common.error'),
        t('review.responseRequired') || 'Veuillez saisir une réponse'
      );
      return;
    }

    const result = existingResponse
      ? await updateResponse(reviewId, responseText)
      : await submitResponse(reviewId, responseText);

    if (result.success) {
      Alert.alert(
        t('review.responseSubmitted') || 'Réponse publiée',
        t('review.responseSubmittedDesc') || 'Votre réponse a été publiée avec succès',
        [
          {
            text: t('common.ok'),
            onPress: () => {
              setResponseText('');
              onResponseSubmitted();
              onClose();
            },
          },
        ]
      );
    } else {
      Alert.alert(
        t('common.error'),
        result.error || t('review.responseError') || 'Erreur lors de la publication de la réponse'
      );
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      t('review.deleteResponse') || 'Supprimer la réponse',
      t('review.deleteResponseConfirm') || 'Êtes-vous sûr de vouloir supprimer cette réponse ?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete') || 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteResponse(reviewId);
            if (result.success) {
              setResponseText('');
              onResponseSubmitted();
              onClose();
            } else {
              Alert.alert(
                t('common.error'),
                result.error || t('review.deleteError') || 'Erreur lors de la suppression'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {existingResponse ? (t('review.editResponse') || 'Modifier votre réponse') : (t('review.respond') || 'Répondre à cet avis')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.label}>
                {t('review.yourResponse') || 'Votre réponse'}
              </Text>
              <TextInput
                style={styles.responseInput}
                value={responseText}
                onChangeText={setResponseText}
                placeholder={t('review.responsePlaceholder') || 'Écrivez votre réponse à cet avis...'}
                multiline
                numberOfLines={6}
                maxLength={1000}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>
                {responseText.length}/1000 {t('review.characters')}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {existingResponse && (
              <TouchableOpacity
                style={[styles.button, styles.deleteButton]}
                onPress={handleDelete}
                disabled={loading}
              >
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={styles.deleteButtonText}>
                  {t('common.delete') || 'Supprimer'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                (loading || !responseText.trim()) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading || !responseText.trim()}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {existingResponse ? (t('common.update') || 'Mettre à jour') : (t('review.publish') || 'Publier')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  responseInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 150,
    backgroundColor: '#f8f9fa',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#2E7D32',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ReviewResponseModal;













