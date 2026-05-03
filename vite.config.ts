import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Variáveis de ambiente expostas ao client devem ter prefixo VITE_
// (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY)
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    sourcemap: false,
    target: 'es2022',
  },
});
