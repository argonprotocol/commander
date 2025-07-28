import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { listen } from '@tauri-apps/api/event';
import App from './App.vue';
import './main.css';
import basicEmitter from './emitters/basicEmitter';

const app = createApp(App);

app.use(createPinia());
app.mount('#app');

// Listen for Tauri events from the backend
listen('openAboutOverlay', () => {
  basicEmitter.emit('openAboutOverlay');
});

window.addEventListener('keydown', e => {
  // Cmd+R (Mac) or Ctrl+R (Win/Linux)
  if (
    (e.metaKey && e.key === 'r') || // Cmd+R
    (e.ctrlKey && e.key === 'r') // Ctrl+R
  ) {
    e.preventDefault();
    // Use location.reload() as fallback since Tauri reload() might not be available
    window.location.reload();
  }
});
