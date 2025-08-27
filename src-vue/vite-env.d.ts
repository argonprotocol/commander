/// <reference types="vite/client" />
/// <reference types="vite-svg-loader" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// Global variables defined by Vite
declare const __ARGON_NETWORK_NAME__: string;
declare const __COMMANDER_INSTANCE__: string;
declare const __COMMANDER_ENABLE_AUTOUPDATE__: boolean;
declare const __COMMANDER_SECURITY__: any;
