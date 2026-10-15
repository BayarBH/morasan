import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['firebase-admin', 'google-auth-library', '@google/genai'],
};

export default config;
