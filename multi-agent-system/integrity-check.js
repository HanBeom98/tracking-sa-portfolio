import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const promptsPath = path.join(__dirname, 'prompts.js');

const SACRED_KEYWORDS = [
    'PremiumComponent', 
    'Shadow DOM', 
    'oklch', 
    'core/builder.py', 
    'addEventListener',
    'word-break: keep-all',
    'connectedCallback',
    'JSON 배열',
    'approved',
    'preserve'
];

function validate() {
    if (!fs.existsSync(promptsPath)) {
        console.error('❌ FATAL: prompts.js is missing!');
        process.exit(1);
    }

    const content = fs.readFileSync(promptsPath, 'utf8');
    let missing = [];

    SACRED_KEYWORDS.forEach(word => {
        if (!content.includes(word)) missing.push(word);
    });

    if (missing.length > 0) {
        console.error('❌ [CRITICAL FAILURE] System integrity compromised!');
        console.error('Missing: ' + missing.join(', '));
        process.exit(1);
    } else {
        console.log('✅ [SUCCESS] System Integrity Secured.');
        process.exit(0);
    }
}
validate();
