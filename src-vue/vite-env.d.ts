/// <reference types="vite/client" />
/// <reference types="vite-svg-loader" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// Global variables defined by Vite
declare const __ARGON_NETWORK_NAME__: string;
declare const __ARGON_NETWORK_URL__: string;
declare const __COMMANDER_INSTANCE_NAME__: string;
declare const __COMMANDER_INSTANCE_PORT__: string;
