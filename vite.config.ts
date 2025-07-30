import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import svgLoader from 'vite-svg-loader';
import wasm from 'vite-plugin-wasm';
import vitePluginTopLevelAwait from 'vite-plugin-top-level-await';

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const requre = createRequire(__filename);

const defaultPortString = '1420';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {

  const envFile = loadEnv(mode, process.cwd(), ''); 
  const host = envFile.TAURI_DEV_HOST;

  const instanceFromEnvFile = (envFile.COMMANDER_INSTANCE || '').split(':');
  const portFromEnvFile = parseInt(envFile.COMMANDER_INSTANCE_PORT || instanceFromEnvFile[1] || defaultPortString, 10);

  const instance = (process.env.COMMANDER_INSTANCE || '').split(':');
  const instancePort = parseInt(process.env.COMMANDER_INSTANCE_PORT || instance[1] || defaultPortString, 10);
  const instanceName = process.env.COMMANDER_INSTANCE_NAME || instance[0] || instanceFromEnvFile[0] || 'default';

  if (portFromEnvFile !== instancePort) {
    const envName = envFile.COMMANDER_INSTANCE_PORT ? 'COMMANDER_INSTANCE_PORT' : 'COMMANDER_INSTANCE';
    throw new Error(`${envName} must be set on the command line not from inside a .env file`);
  }

  return {
    resolve: {
      alias: {
        '@argonprotocol/bitcoin': requre.resolve('@argonprotocol/bitcoin/browser'),
      },
    },
    plugins: [
      wasm(),
      vitePluginTopLevelAwait(),
      vue(),
      tailwindcss(),
      svgLoader({
        svgoConfig: {
          multipass: true,
          plugins: [
            {
              name: 'preset-default',
              params: {
                overrides: {
                  removeViewBox: false,
                },
              },
            },
          ],
        },
      }),
    ],
    // Define environment variables for the frontend
    define: {
      'process.env': {},
      __ARGON_NETWORK_NAME__: JSON.stringify(envFile.ARGON_NETWORK_NAME || ''),
      __ARGON_NETWORK_URL__: JSON.stringify(process.env.ARGON_NETWORK_URL || ''),
      __COMMANDER_INSTANCE_NAME__: JSON.stringify(instanceName || ''),
      __COMMANDER_INSTANCE_PORT__: JSON.stringify(instancePort || ''),
    },
    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: instancePort,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: 'ws',
            host,
            port: instancePort + 1,
          }
        : undefined,
      watch: {
        // 3. tell vite to ignore watching `src-tauri`
        ignored: ['**/src-tauri/**'],
      },
    },
  };
});
