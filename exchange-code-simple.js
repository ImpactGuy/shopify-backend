/**
 * Simple token exchange using Node.js built-in fetch
 * Works better with corporate proxies/firewalls
 */

const APP_KEY = '48vtrhbnil7frx9';
const APP_SECRET = '2dabbgbr0x5f6q7';
const AUTH_CODE = 'PASTE_NEW_CODE_HERE'; // Replace with fresh code from authorization URL

async function exchangeCode() {
  console.log('\n🔄 Exchanging authorization code for tokens...\n');

  try {
    const params = new URLSearchParams({
      code: AUTH_CODE,
      grant_type: 'authorization_code',
      client_id: APP_KEY,
      client_secret: APP_SECRET,
    });

    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ HTTP Error:', response.status, response.statusText);
      console.error('Response:', error);
      
      if (error.includes('invalid_grant')) {
        console.error('\n⚠️ Authorization code expired or already used!');
        console.error('Get a new code from:');
        console.error(`https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=code&token_access_type=offline`);
      }
      process.exit(1);
    }

    const data = await response.json();

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                   ✅ SUCCESS!                            ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log('Add these to your .env file:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`DROPBOX_APP_KEY=${APP_KEY}`);
    console.log(`DROPBOX_APP_SECRET=${APP_SECRET}`);
    console.log(`DROPBOX_REFRESH_TOKEN=${data.refresh_token}`);
    console.log(`DROPBOX_ROOT_PATH=/Mülltonnenbeschriftungen`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('ℹ️  IMPORTANT:');
    console.log('• Refresh token NEVER expires');
    console.log('• Backend auto-refreshes access tokens\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Network issue detected. Try:');
      console.error('1. Check if you\'re behind a corporate firewall/proxy');
      console.error('2. Try using a VPN or different network');
      console.error('3. Use the cURL command method instead (see below)\n');
      
      console.log('📋 Use this cURL command instead:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`curl -X POST https://api.dropboxapi.com/oauth2/token \\`);
      console.log(`  -H "Content-Type: application/x-www-form-urlencoded" \\`);
      console.log(`  -d "code=${AUTH_CODE}" \\`);
      console.log(`  -d "grant_type=authorization_code" \\`);
      console.log(`  -d "client_id=${APP_KEY}" \\`);
      console.log(`  -d "client_secret=${APP_SECRET}"`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
  }
}

exchangeCode();

