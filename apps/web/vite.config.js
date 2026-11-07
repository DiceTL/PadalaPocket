import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const publicEnv = loadEnv(process.env.NODE_ENV === 'production' ? 'production' : 'development', root, ['VITE_', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY']);
export default defineConfig({
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(publicEnv.VITE_SUPABASE_URL || publicEnv.SUPABASE_URL || ''),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY || publicEnv.SUPABASE_PUBLISHABLE_KEY || ''),
  },
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
});
