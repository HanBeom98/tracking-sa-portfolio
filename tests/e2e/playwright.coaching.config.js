import local from './playwright.auth.config.js';
import { fileURLToPath } from 'node:url';
export default { ...local, testMatch: 'local-coaching.spec.js', globalSetup: fileURLToPath(new URL('./coaching-server.mjs', import.meta.url)) };
