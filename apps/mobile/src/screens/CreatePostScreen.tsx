import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts, spacing, borderRadius, shadows } from '../constants/theme';
import { API_BASE, getAuthHeader, getSessionToken } from '../services/authSession';
import {
  pickImageFromGallery,
  captureImageWithCamera,
  requestUploadIntent,
  uploadImageToStorage,
} from '../services/storageService';

export const CreatePostScreen: React.FC<any> = ({ navigation }) => {
  const [caption, setCaption] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [category, setCategory] = useState<'wedding_story' | 'culture' | 'festivals' | 'advice'>('wedding_story');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState('');

  const categories = [
    { key: 'wedding_story', label: 'Wedding Story' },
    { key: 'festivals', label: 'Festive Celebration' },
    { key: 'culture', label: 'Tradition / Culture' },
    { key: 'advice', label: 'Ceremony Advice' },
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

      // Step 1: Request signed upload intent from backend
      setUploadProgressMsg('Generating upload intent...');
      const fileName = selectedPhoto.fileName || `community_${Date.now()}.jpg`;
      const fileType = selectedPhoto.mimeType || 'image/jpeg';
      const fileSizeBytes = selectedPhoto.fileSize || 1024 * 500;

      const intent = await requestUploadIntent(token, {
        purpose: 'community_post',
        fileName,
        fileType,
        fileSizeBytes,
      });

      // Step 2: Upload photo bytes/base64 to backend storage gateway
      setUploadProgressMsg('Uploading photo to storage...');
      const uploadRes = await uploadImageToStorage(intent, selectedPhoto.base64 || undefined);
      const uploadedMediaUrl = uploadRes.url;

      // Step 3: Create post with uploaded media URL
      setUploadProgressMsg('Publishing story for moderation...');
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Community Story</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Category Selection */}
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoriesGrid}>
          {categories.map((c) => {
            const isSelected = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.categoryBtn, isSelected && styles.categoryBtnActive]}
                onPress={() => setCategory(c.key as any)}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={14} color={colors.royalMaroon} style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.categoryBtnText, isSelected && styles.categoryBtnTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Photo Selection & Preview Card */}
        <Text style={styles.label}>Story Photo</Text>
        {selectedPhoto ? (
          <View style={styles.previewCard}>
            <Image source={{ uri: selectedPhoto.uri }} style={styles.previewImage} resizeMode="cover" />
            <View style={styles.photoTagBadge}>
              <Text style={styles.photoTagText}>STORY PHOTO READY</Text>
            </View>
            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.actionPill}
                onPress={handlePickFromGallery}
                disabled={submitting}
              >
                <Ionicons name="images-outline" size={14} color={colors.royalMaroon} />
                <Text style={styles.actionPillText}>Replace</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionPill, { borderColor: '#E8D4D6' }]}
                onPress={() => setSelectedPhoto(null)}
                disabled={submitting}
              >
                <Ionicons name="trash-outline" size={14} color={colors.alertRed} />
                <Text style={[styles.actionPillText, { color: colors.alertRed }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.photoPickerBox}>
            <Ionicons name="images-outline" size={40} color={colors.softGold} style={{ marginBottom: 8 }} />
            <Text style={styles.pickerTitle}>Add a Celebration or Wedding Photo</Text>
            <Text style={styles.pickerSub}>Select from gallery or capture with camera (max 5MB)</Text>
            <View style={styles.pickerBtnsRow}>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={handlePickFromGallery}
                activeOpacity={0.8}
              >
                <Ionicons name="images" size={16} color="#FFFFFF" />
                <Text style={styles.pickerButtonText}>Choose from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pickerButtonOutline}
                onPress={handleCaptureCamera}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={16} color={colors.royalMaroon} />
                <Text style={styles.pickerButtonOutlineText}>Take Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Caption Input */}
        <Text style={styles.label}>Caption & Celebration Story</Text>
        <TextInput
          style={[styles.textInput, { height: 110, textAlignVertical: 'top' }]}
          value={caption}
          onChangeText={setCaption}
          placeholder="Share your wedding memory, joyful moments, or traditional celebrations..."
          placeholderTextColor="#9E9E9E"
          multiline
          maxLength={1000}
        />

        {/* Moderation Safety Notice */}
        <View style={styles.noteBox}>
          <Ionicons name="shield-checkmark" size={18} color={colors.royalMaroon} />
          <Text style={styles.noteText}>
            All community stories are reviewed by ShaadiBanao administrators before public display to keep the community respectful, safe, and family-friendly.
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.8 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={[styles.submitBtnText, { marginLeft: 8 }]}>
                {uploadProgressMsg || 'Submitting Story...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.submitBtnText}>Submit Story for Review</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5EE',
  },
  header: {
    backgroundColor: colors.royalMaroon,
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: colors.royalGold,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 14,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '700',
    color: colors.royalMaroon,
    marginBottom: 8,
    marginTop: 12,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E8E2D8',
  },
  categoryBtnActive: {
    backgroundColor: '#FFF0F4',
    borderColor: colors.royalMaroon,
    borderWidth: 1.5,
  },
  categoryBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    fontWeight: '500',
  },
  categoryBtnTextActive: {
    color: colors.royalMaroon,
    fontFamily: fonts.bodySemiBold,
    fontWeight: '700',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E2D8',
    overflow: 'hidden',
    marginBottom: 14,
    ...shadows.card,
  },
  previewImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#F0ECE4',
  },
  photoTagBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(128, 0, 32, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  photoTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: fonts.headingBold,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#FAF5ED',
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  actionPillText: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    fontWeight: '600',
    color: colors.royalMaroon,
  },
  photoPickerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.royalGold,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
  },
  pickerTitle: {
    fontSize: 14,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '700',
    color: colors.charcoal,
    marginBottom: 4,
  },
  pickerSub: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  pickerBtnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.royalMaroon,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  pickerButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
  },
  pickerButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.royalMaroon,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  pickerButtonOutlineText: {
    color: colors.royalMaroon,
    fontSize: 12,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D8',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    marginBottom: 14,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FAF5ED',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8DFD0',
    marginVertical: 10,
  },
  noteText: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    marginLeft: 8,
    flex: 1,
    lineHeight: 17,
  },
  submitBtn: {
    backgroundColor: colors.royalMaroon,
    paddingVertical: 14,
    minHeight: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    ...shadows.card,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

