import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // Production is active if EAS build profile is production or APP_ENV is production
  const isProduction =
    process.env.APP_ENV === 'production' ||
    process.env.EAS_BUILD_PROFILE === 'production' ||
    process.env.NODE_ENV === 'production';

  return {
    ...config,
    name: config.name || 'ShaadiBanao',
    slug: config.slug || 'shaadibanao',
    android: {
      ...config.android,
      package: 'com.shaadibanao.app',
      // Strictly disable cleartext HTTP in production builds; allow in local dev
      usesCleartextTraffic: !isProduction,
    } as any,
  };
};
