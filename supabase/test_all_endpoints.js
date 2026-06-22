const BASE_URL = 'http://localhost:3000';
const USER_ID = 'b3df18f1-20e4-4099-bde9-444bfb65ec57';

async function testEndpoint(name, url, options = {}) {
  console.log(`\n--- Testing ${name} [${options.method || 'GET'} ${url}] ---`);
  try {
    const res = await fetch(`${BASE_URL}${url}`, options);
    console.log(`Status: ${res.status} ${res.statusText}`);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      console.log('Response (JSON):', JSON.stringify(data, null, 2));
    } else {
      const text = await res.text();
      console.log('Response (Text):', text.substring(0, 300) + (text.length > 300 ? '...' : ''));
    }
  } catch (err) {
    console.error(`Error testing ${name}:`, err.message);
  }
}

async function runTests() {
  // 1. Test video integration
  await testEndpoint(
    'Vimeo Live Integration Feed',
    '/api/integrations/video?url=https://vimeo.com/768058292'
  );

  // 2. Test drive integration
  await testEndpoint(
    'Google Drive Folder Browser',
    `/api/integrations/drive?userId=${USER_ID}&url=https://drive.google.com/drive/folders/12345_test`
  );

  // 3. Test calendar integration POST (Pull)
  await testEndpoint(
    'Google Calendar Integration Pull Action',
    '/api/integrations/calendar',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pull', userId: USER_ID })
    }
  );

  // 4. Test calendar integration POST (Push without jobId)
  await testEndpoint(
    'Google Calendar Integration Push Action (No job)',
    '/api/integrations/calendar',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'push', userId: USER_ID })
    }
  );

  // 5. Test geocode endpoint
  await testEndpoint(
    'Geocoding API Lookup',
    '/api/geocode?address=Hudson+Theatre+NYC'
  );

  // 6. Test hospital endpoint
  await testEndpoint(
    'Nearest Hospital API Lookup',
    '/api/hospital?address=Hudson+Theatre+NYC'
  );

  // 7. Test parking endpoint
  await testEndpoint(
    'Nearest Parking API Lookup',
    '/api/parking?address=Hudson+Theatre+NYC'
  );

  // 8. Test calendar ICS feed
  await testEndpoint(
    'Slate Subscription Calendar ICS Feed',
    '/api/calendar'
  );

  // 9. Test Discord webhook POST
  await testEndpoint(
    'Discord Webhook Dispatch Alert',
    '/api/integrations/discord',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '🛠️ **Studio OS Automated Integration Health Check**\nAll systems checked.'
      })
    }
  );
}

runTests();
