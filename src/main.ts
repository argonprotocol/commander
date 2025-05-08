import {createApp} from 'vue';
import {createPinia} from 'pinia';
import App from './App.vue';
import './main.css';
import {attachLogger, debug, error, info, LogLevel, trace, warn} from "@tauri-apps/plugin-log";

// const ConsoleLogger = {
//     [LogLevel.Trace]: console.log.bind(console),
//     [LogLevel.Debug]: console.debug.bind(console),
//     [LogLevel.Info]: console.info.bind(console),
//     [LogLevel.Warn]: console.warn.bind(console),
//     [LogLevel.Error]: console.error.bind(console),
// }
// void attachLogger(({ level, message }) => {
//     ConsoleLogger[level]?.(message);
// });
function forwardConsole(
    fnName: 'log' | 'debug' | 'info' | 'warn' | 'error',
    logger: (message: string) => Promise<void>
) {
    const original = console[fnName];
    console[fnName] = (message) => {
        original(message);
        logger(message);
    };
}
forwardConsole('log', trace);
forwardConsole('debug', debug);
forwardConsole('info', info);
forwardConsole('warn', warn);
forwardConsole('error', error);

const app = createApp(App)

app.use(createPinia())
app.mount("#app");
