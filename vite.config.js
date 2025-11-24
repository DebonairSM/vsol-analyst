import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    allowedHosts: [
      'sunny.vsol.software'
    ]
  }
});