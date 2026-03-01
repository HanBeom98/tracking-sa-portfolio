const API_KEY = 'live_6e6f12fbfb54d0fad8b504b3303286fb1ce29b5a4e2f456d883cc44b2af445e6efe8d04e6d233bd35cf2fabdeb93fb0d';
const OUID = '6faff124bec116572f419883c14fd955';
const BASE_URL = 'https://open.api.nexon.com/suddenattack/v1/match';

async function testMode(mode) {
  const params = new URLSearchParams({ 
    ouid: OUID,
    match_mode: mode 
  });
  
  const url = `${BASE_URL}?${params.toString()}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'x-nxopen-api-key': API_KEY }
    });
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ [MODE SUCCESS] "${mode}" -> Found: ${data.match?.length || 0}`);
      return data.match || [];
    } else {
      return [];
    }
  } catch (err) {
    return [];
  }
}

async function runTests() {
  console.log('--- Sudden Attack Match Mode Discovery (Type=ANY) ---');
  const modes = ["폭파미션", "데스매치", "점령전", "생존모드", "개인전", "섬멸전", "스나이퍼전", "칼전", "권총전"];
  for (const mode of modes) {
    await testMode(mode);
    await new Promise(r => setTimeout(r, 200));
  }
}

runTests();
