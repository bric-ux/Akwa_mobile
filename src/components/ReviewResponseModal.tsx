import React, { useState, useEffect, useRef } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReviewResponses } from '../hooks/useReviewResponses';
import { useLanguage } from '../contexts/LanguageContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { submitResponse, updateResponse, deleteResponse, loading } = useReviewResponses();
  const [responseText, setResponseText] = useState('');
  const [rating, setRating] = useState(0);
  const [cleanlinessRating, setCleanlinessRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [respectRulesRating, setRespectRulesRating] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      setResponseText(existingResponse || '');
      setRating(0);
      setCleanlinessRating(0);
      setCommunicationRating(0);
      setRespectRulesRating(0);
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

    if (!existingResponse && (rating < 1 || rating > 5)) {
      Alert.alert(
        t('common.error'),
        t('review.rateGuestToPublish') || 'Pour que l’avis soit publié, donnez une note au voyageur (1 à 5 étoiles).'
      );
      return;
    }

    const result = existingResponse
      ? await updateResponse(reviewId, responseText)
      : await submitResponse(reviewId, responseText, rating, {
          cleanlinessRating: cleanlinessRating || undefined,
          communicationRating: communicationRating || undefined,
          respectRulesRating: respectRulesRating || undefined,
        });

    if (result.success) {
      Alert.alert(
        t('review.responseSubmitted') || 'Réponse publiée',
        t('review.responseSubmittedDesc') || 'Votre réponse a été publiée avec succès',
        [
          {
            text: t('common.ok'),
            onPress: () => {
              setResponseText('');
              setRating(0);
              setCleanlinessRating(0);
              setCommunicationRating(0);
              setRespectRulesRating(0);
              onResponseSubmitted();
              onClose();
            },
          },
        ]
      );
    } else {
      Alert.alert(
        t('common.error'),
        t('review.responseError') || 'Erreur lors de la publication de la réponse'
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
                t('review.deleteError') || 'Erreur lors de la suppression'
              );
            }
          },
        },
      ]
    );
  };

  const canSubmit = responseText.trim().length > 0 && (!!existingResponse || (rating >= 1 && rating <= 5));

  const StarRatingRow = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
    <View style={styles.ratingCategory}>
      <Text style={styles.ratingCategoryLabel}>{label}</Text>
      <View style={styles.starsRowInput}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => onChange(star)} style={styles.starTouch} activeOpacity={0.7}>
            <Ionicons name={value >= star ? 'star' : 'star-outline'} size={28} color={value >= star ? '#fbbf24' : '#d1d5db'} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <StatusBar backgroundColor="rgba(0, 0, 0, 0.5)" barStyle="light-content" />
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {existingResponse ? (t('review.editResponse') || 'Modifier votre réponse') : (t('review.respond') || 'Répondre à cet avis')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoidingView}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.content}
              contentContainerStyle={[styles.contentContainer, { paddingBottom: 280 }]}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {!existingResponse && (
                <View style={styles.section}>
                  <Text style={styles.ratingHint}>
                    {t('review.rateGuestToPublishHint')}
                  </Text>
                  <StarRatingRow
                    value={rating}
                    onChange={setRating}
                    label={t('review.rateGuest')}
                  />
                  <StarRatingRow
                    value={cleanlinessRating}
                    onChange={setCleanlinessRating}
                    label={t('review.cleanliness')}
                  />
                  <StarRatingRow
                    value={communicationRating}
                    onChange={setCommunicationRating}
                    label={t('review.communication')}
                  />
                  <StarRatingRow
                    value={respectRulesRating}
                    onChange={setRespectRulesRating}
                    label={t('review.respectRules')}
                  />
                </View>
              )}
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
                  numberOfLines={10}
                  maxLength={1000}
                  textAlignVertical="top"
                  onFocus={() => {
                    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
                  }}
                />
                <Text style={styles.charCount}>
                  {responseText.length}/1000 {t('review.characters')}
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>

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
                (loading || !canSubmit) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading || !canSubmit}
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
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_HEIGHT * 0.85,
    maxHeight: SCREEN_HEIGHT * 0.9,
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    minHeight: 60,
    zIndex: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    marginLeft: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 10,
  },
  section: {
    marginBottom: 24,
  },
  ratingHint: {
    fontSize: 14,
    color: '#555',
    marginBottom: 12,
    lineHeight: 20,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  starTouch: {
    padding: 4,
  },
  ratingLabel: {
    fontSize: 13,
    color: '#666',
  },
  ratingCategory: {
    marginBottom: 14,
  },
  ratingCategoryLabel: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
  },
  starsRowInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
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
    minHeight: 200,
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
    minHeight: 50,
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













