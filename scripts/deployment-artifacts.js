import { readFileSync } from 'node:fs';

// Preserve the existing import path; Node and Python read the same manifest.
export default JSON.parse(readFileSync(new URL('./deployment-artifacts.json', import.meta.url), 'utf8'));
