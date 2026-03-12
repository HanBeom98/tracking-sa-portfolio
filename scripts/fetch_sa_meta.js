import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Using a simpler approach for API Key to avoid ESM/CJS dotenv issues in standalone script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const META_DIR = path.join(__dirname, '../src/domains/stats/sudden-attack/infra/meta');

if (!fs.existsSync(META_DIR)) {
  fs.mkdirSync(META_DIR, { recursive: true });
}

const BASE_URL = 'https://open.api.nexon.com/static/suddenattack/meta';
const files = ['grade', 'season_grade', 'tier', 'logo'];

// Hardcoded live key from main.js as fallback for the script
const API_KEY = 'live_6e6f12fbfb54d0fad8b504b3303286fb1ce29b5a4e2f456d883cc44b2af445e6efe8d04e6d233bd35cf2fabdeb93fb0d';

async function downloadMeta() {
  console.log('--- Downloading Sudden Attack Meta to Local ---');
  for (const file of files) {
    try {
      console.log(`Fetching ${file}...`);
      const response = await fetch(`${BASE_URL}/${file}`, {
        headers: {
          'x-nxopen-api-key': API_KEY,
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        fs.writeFileSync(path.join(META_DIR, `${file}.json`), JSON.stringify(data, null, 2));
        console.log(`✅ Saved ${file}.json to local storage.`);
      } else {
        console.error(`❌ Failed to fetch ${file}: ${response.status}`);
      }
    } catch (err) {
      console.error(`⚠️ Error downloading ${file}:`, err.message);
    }
  }
}

downloadMeta();
