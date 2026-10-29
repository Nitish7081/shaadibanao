import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { ds, PressableScale } from '../design';
import { API_BASE, getAuthHeader, getSessionToken } from '../services/authSession';
import {
  pickImageFromGallery,
  captureImageWithCamera,
} from '../services/storageService';
import { uploadAsset } from '../services/imageUpload';

export const CreatePostScreen: React.FC<any> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [caption, setCaption] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [category, setCategory] = useState<'wedding_story' | 'culture' | 'festivals' | 'advice'>('wedding_story');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState('');

  const categories = [
    { key: 'wedding_story', label: t('communityScreen.weddings'), icon: 'heart' as const },
    { key: 'festivals', label: t('communityScreen.festivals'), icon: 'flame' as const },
    { key: 'culture', label: t('communityScreen.traditions'), icon: 'rose' as const },
    { key: 'advice', label: t('communityScreen.advice'), icon: 'book' as const },
  ];

  const handlePickFromGallery = async () => {
    try {
      const asset = await pickImageFromGallery({ aspect: [4, 3] });
      if (asset) {
        setSelectedPhoto(asset);
      }
    } catch (err: any) {
      Alert.alert('Gallery Notice', err.message || 'Unable to select photo.');
    }
  };

  const handleCaptureCamera = async () => {
    try {
      const asset = await captureImageWithCamera({ aspect: [4, 3] });
      if (asset) {
        setSelectedPhoto(asset);
      }
    } catch (err: any) {
      Alert.alert('Camera Notice', err.message || 'Unable to capture photo.');
    }
  };

  const handleSubmit = async () => {
    if (!selectedPhoto) {
      Alert.alert('Photo Required', 'Please choose or capture a photo for your community story.');
      return;
    }

    if (!caption.trim()) {
      Alert.alert('Caption Required', 'Please write a caption or story description.');
      return;
    }

    setSubmitting(true);
    setUploadProgressMsg('Securing upload credentials...');

    try {
      const token = getSessionToken();
      if (!token) {
        throw new Error('You must be signed in to post stories.');
      }

      setUploadProgressMsg('Uploading photo to Cloudinary...');
      const uploadRes = await uploadAsset({
        token,
        asset: selectedPhoto,
        purpose: 'community_post',
        onProgress: (pct) => setUploadProgressMsg(`Uploading photo... ${pct}%`),
      });
      const uploadedMediaUrl = uploadRes.url;

      setUploadProgressMsg('Publishing story for review...');
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/community/posts`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaUrl: uploadedMediaUrl,
          publicId: uploadRes.publicId,
          caption: caption.trim(),
          category,
        }),
      });

      const json = await res.json();
      if (json.success) {
        Alert.alert(
          'Story Submitted! 🎉',
          'Your community photo story has been submitted. It will appear on the public feed once approved by our moderation team.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Submission Notice', json.error?.message || json.message || 'Story submission failed.');
      }
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Could not complete upload. Please check your connection and retry.');
    } finally {
      setSubmitting(false);
      setUploadProgressMsg('');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      {/* Navigation Bar */}
      <View style={styles.topNav}>
        <PressableScale
          style={styles.navBackBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color={ds.color.maroon} />
        </PressableScale>
        <Text
          maxFontSizeMultiplier={1.2}
          style={styles.navTitle}
        >
          {t('communityScreen.createTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 40, 60) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Category Selection */}
        <View style={styles.sectionWrap}>
          <Text maxFontSizeMultiplier={1.2} style={styles.fieldLabel}>
            {t('communityScreen.categoryLabel')}
          </Text>
          <View style={styles.categoriesRow}>
            {categories.map((c) => {
              const isSelected = category === c.key;
              return (
                <PressableScale
                  key={c.key}
                  style={[styles.catBtn, isSelected && styles.catBtnActive]}
                  onPress={() => setCategory(c.key as any)}
                >
                  <Ionicons
                    name={c.icon}
                    size={15}
                    color={isSelected ? '#FFFFFF' : ds.color.maroon}
                  />
                  <Text
                    maxFontSizeMultiplier={1.2}
                    style={[styles.catBtnText, isSelected && styles.catBtnTextActive]}
                  >
                    {c.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </View>

        {/* Photo Selection Card */}
        <View style={styles.sectionWrap}>
          <Text maxFontSizeMultiplier={1.2} style={styles.fieldLabel}>
            {t('communityScreen.photoLabel')}
          </Text>

          {selectedPhoto ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: selectedPhoto.uri }} style={styles.previewImage} />
              <PressableScale
                style={styles.changePhotoBtn}
                onPress={handlePickFromGallery}
              >
                <Ionicons name="camera-reverse-outline" size={16} color="#FFFFFF" />
                <Text maxFontSizeMultiplier={1.2} style={styles.changePhotoBtnText}>
                  {t('communityScreen.changePhoto')}
                </Text>
              </PressableScale>
            </View>
          ) : (
            <View style={styles.photoPickerCard}>
              <View style={styles.photoIconCircle}>
                <Ionicons name="image-outline" size={32} color={ds.color.maroon} />
              </View>
              <Text maxFontSizeMultiplier={1.2} style={styles.pickerHintTitle}>
                Add a sacred celebration photo
              </Text>
              <Text maxFontSizeMultiplier={1.2} style={styles.pickerHintSub}>
                Upload high quality JPG, PNG or WEBP (up to 5 MB)
              </Text>

              <View style={styles.pickerActionRow}>
                <PressableScale
                  style={styles.pickerOptionBtn}
                  onPress={handlePickFromGallery}
                >
                  <Ionicons name="images-outline" size={18} color={ds.color.maroon} />
                  <Text maxFontSizeMultiplier={1.2} style={styles.pickerOptionText}>
                    {t('communityScreen.galleryBtn')}
                  </Text>
                </PressableScale>

                <PressableScale
                  style={styles.pickerOptionBtn}
                  onPress={handleCaptureCamera}
                >
                  <Ionicons name="camera-outline" size={18} color={ds.color.maroon} />
                  <Text maxFontSizeMultiplier={1.2} style={styles.pickerOptionText}>
                    {t('communityScreen.cameraBtn')}
                  </Text>
                </PressableScale>
              </View>
            </View>
          )}
        </View>

        {/* Caption Input */}
        <View style={styles.sectionWrap}>
          <Text maxFontSizeMultiplier={1.2} style={styles.fieldLabel}>
            {t('communityScreen.captionLabel')}
          </Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.textInput}
              multiline
              numberOfLines={4}
              maxLength={500}
              placeholder={t('communityScreen.captionPlaceholder')}
              placeholderTextColor={ds.color.textMuted}
              value={caption}
              onChangeText={setCaption}
              textAlignVertical="top"
            />
            <Text maxFontSizeMultiplier={1.2} style={styles.charCount}>
              {caption.length} / 500
            </Text>
          </View>
        </View>

        {/* Sacred Community Guidelines Card */}
        <View style={styles.guidelinesCard}>
          <View style={styles.guidelinesHeader}>
            <Ionicons name="shield-checkmark" size={18} color="#166534" />
            <Text maxFontSizeMultiplier={1.2} style={styles.guidelinesTitle}>
              {t('communityScreen.guidelinesTitle')}
            </Text>
          </View>
          <Text maxFontSizeMultiplier={1.2} style={styles.guidelinesBody}>
            {t('communityScreen.guidelinesBody')}
          </Text>
        </View>

        {/* Progress Message */}
        {submitting && (
          <View style={styles.progressRow}>
            <ActivityIndicator size="small" color={ds.color.maroon} />
            <Text maxFontSizeMultiplier={1.2} style={styles.progressText}>
              {uploadProgressMsg}
            </Text>
          </View>
        )}

        {/* Submit Button */}
        <PressableScale
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <LinearGradient
            colors={['#7A1528', '#9B1D36']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGradient}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text maxFontSizeMultiplier={1.2} style={styles.submitBtnText}>
                  {t('communityScreen.submitBtn')}
                </Text>
              </>
            )}
          </LinearGradient>
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screenBg: {
    flex: 1,
    backgroundColor: ds.color.bg,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ds.space.md,
    paddingVertical: ds.space.sm,
    backgroundColor: ds.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: ds.color.border,
  },
  navBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ds.color.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ds.color.text,
  },
  scrollContent: {
    padding: ds.space.md,
  },
  sectionWrap: {
    marginBottom: ds.space.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: ds.color.text,
    marginBottom: 8,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surface,
    borderWidth: 1,
    borderColor: ds.color.border,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    gap: 6,
  },
  catBtnActive: {
    backgroundColor: ds.color.maroon,
    borderColor: ds.color.maroon,
  },
  catBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.text,
  },
  catBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  photoPickerCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: ds.color.border,
    borderStyle: 'dashed',
    padding: ds.space.lg,
    alignItems: 'center',
  },
  photoIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ds.color.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ds.space.sm,
  },
  pickerHintTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: ds.color.text,
    marginBottom: 4,
  },
  pickerHintSub: {
    fontSize: 12,
    color: ds.color.textMuted,
    marginBottom: ds.space.md,
    textAlign: 'center',
  },
  pickerActionRow: {
    flexDirection: 'row',
    gap: ds.space.md,
    width: '100%',
  },
  pickerOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
  },
  pickerOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.maroon,
  },
  previewContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: ds.color.border,
    aspectRatio: 4 / 3,
    ...ds.shadow.soft,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  changePhotoBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    gap: 6,
  },
  changePhotoBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inputCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.md,
    ...ds.shadow.soft,
  },
  textInput: {
    fontSize: 14,
    color: ds.color.text,
    minHeight: 90,
    lineHeight: 20,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 11,
    color: ds.color.textMuted,
    marginTop: 4,
  },
  guidelinesCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: ds.space.md,
    marginBottom: ds.space.lg,
  },
  guidelinesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  guidelinesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  guidelinesBody: {
    fontSize: 12,
    color: '#15803D',
    lineHeight: 18,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: ds.space.md,
  },
  progressText: {
    fontSize: 13,
    color: ds.color.maroon,
    fontWeight: '600',
  },
  submitBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    ...ds.shadow.soft,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
