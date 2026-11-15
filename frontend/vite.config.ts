import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const devApiProxy = {
  '/api': process.env.VITE_DEV_API_TARGET || 'http://localhost:8002',
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    outDir: 'build'
  },

  // Server configuration
  server: {
    port: 3000,
    host: '0.0.0.0', // Explicitly bind to all interfaces
    allowedHosts: true,
    // Local development: send API calls to the back end (see backend/dev_server.py)
    proxy: devApiProxy,
  },
  
  // `vite preview` (a local look at the production build) uses the same back end
  preview: {
    proxy: devApiProxy,
  },

  // Environment variables configuration
  define: {
    'process.env.REACT_APP_BACKEND_URL': JSON.stringify(process.env.REACT_APP_BACKEND_URL),
  },
  
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
