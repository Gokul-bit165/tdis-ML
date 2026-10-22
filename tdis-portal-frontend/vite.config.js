import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // TDIS AI Assistant (threads, chat-stream, org admin). NOT the portal API (api repo).
  // Portal API has /api/v1/* only; /queries/* lives on the AI FastAPI app.
  // Override with VITE_AI_PROXY_TARGET=http://127.0.0.1:8000 when running that app locally.
  const aiProxyTarget = env.VITE_AI_PROXY_TARGET?.trim() || 'http://127.0.0.1:8000';
  const aiProxySecure = aiProxyTarget.startsWith('https');

  const aiProxy = {
    target: aiProxyTarget,
    changeOrigin: true,
    secure: aiProxySecure,
  };

  const portalApiTarget =
    env.VITE_PORTAL_API_TARGET?.trim() ||
    (env.VITE_API_URL?.startsWith('http')
      ? env.VITE_API_URL.replace(/\/api\/v1\/?$/, '')
      : 'https://api-new-portal.dev.cloud.tdis.io');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api/v1': {
          target: portalApiTarget,
          changeOrigin: true,
          secure: false,
          headers: {
            Origin: 'https://portal.dev.cloud.tdis.io',
          },
        },
        '/api/emails': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
        '/queries': aiProxy,
        '/signup': aiProxy,
        '/organizations': aiProxy,
        '/admin/pricing-tiers': aiProxy,
      },
    },
  };
});
