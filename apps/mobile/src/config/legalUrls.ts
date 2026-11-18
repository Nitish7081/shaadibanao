import { Linking, Alert } from 'react-native';

const DEFAULT_PUBLIC_WEB_URL = 'https://shaadibanao-website.onrender.com';

const normalizeBaseUrl = (raw?: string): string => {
  const clean = (raw || DEFAULT_PUBLIC_WEB_URL).trim().replace(/\/+$/, '');
  return clean || DEFAULT_PUBLIC_WEB_URL;
};

export const PUBLIC_WEB_BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_WEB_URL);

export const LEGAL_URLS = {
  home: `${PUBLIC_WEB_BASE_URL}/`,
  privacyPolicy: `${PUBLIC_WEB_BASE_URL}/privacy-policy`,
  termsAndConditions: `${PUBLIC_WEB_BASE_URL}/terms-and-conditions`,
  deleteAccount: `${PUBLIC_WEB_BASE_URL}/delete-account`,
  contact: `${PUBLIC_WEB_BASE_URL}/contact`,
} as const;

export async function openExternalLegalUrl(url: string, label = 'Legal Document'): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return;
    }
    Alert.alert(label, `Please open this official page in your browser:\n\n${url}`);
  } catch {
    Alert.alert(label, `Unable to open browser automatically. Official URL:\n\n${url}`);
  }
}
