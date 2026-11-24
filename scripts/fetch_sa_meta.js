import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const META_DIR = path.join(__dirname, '../src/domains/stats/sudden-attack/infra/meta');

if (!fs.existsSync(META_DIR)) {
  fs.mkdirSync(META_DIR, { recursive: true });
}

const BASE_URL = 'https://open.api.nexon.com/static/suddenattack/meta';
const files = ['grade', 'season_grade', 'tier', 'logo'];

const API_KEY = String(process.env.NEXON_API_KEY || '').trim();

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

if (!API_KEY) {
  console.error('❌ NEXON_API_KEY 환경변수가 필요합니다. .env 또는 실행 환경에 키를 설정해 주세요.');
  process.exitCode = 1;
} else {
  downloadMeta();
}
