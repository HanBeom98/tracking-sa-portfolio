const API_KEY = 'live_6e6f12fbfb54d0fad8b504b3303286fb1ce29b5a4e2f456d883cc44b2af445e6efe8d04e6d233bd35cf2fabdeb93fb0d';
const OUID = '6faff124bec116572f419883c14fd955';
const BASE_URL = 'https://open.api.nexon.com/suddenattack/v1/match';

async function testKoreanParams() {
  console.log('--- Sudden Attack Match API Korean Param Test ---');
  
  // Test with Clan Match & Explosion Mission as provided in your curl
  const type = encodeURIComponent('클랜전');
  const mode = encodeURIComponent('폭파미션');
  
  const url = `${BASE_URL}?ouid=${OUID}&match_type=${type}&match_mode=${mode}`;
  
  console.log(`Testing URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: { 'x-nxopen-api-key': API_KEY }
    });
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ SUCCESS! Found matches: ${data.match?.length || 0}`);
      if (data.match && data.match.length > 0) {
        console.log('Sample match:', JSON.stringify(data.match[0], null, 2));
      }
    } else {
      console.log(`❌ FAILED (${response.status}) - ${data.error?.name}: ${data.error?.message}`);
    }
  } catch (err) {
    console.log(`⚠️ ERROR - ${err.message}`);
  }
}

testKoreanParams();
