import type { CapacitorConfig } from '@capacitor/cli';

// This app is a full Next.js server (auth, Stripe, Supabase, external API
// routes) — not a static site — so the native shell loads the live
// production domain directly rather than bundling a local build.
const config: CapacitorConfig = {
  appId: 'app.tystable',
  appName: "Ty's Table",
  webDir: 'public',
  server: {
    url: 'https://tystable.app',
    androidScheme: 'https',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
