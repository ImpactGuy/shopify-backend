/**
 * Get Dropbox OAuth Refresh Token
 * This refresh token never expires and can be used to get new access tokens
 * 
 * SETUP:
 * 1. Go to https://www.dropbox.com/developers/apps
 * 2. Select your app
 * 3. Copy "App key" and "App secret" from Settings tab
 * 4. Replace APP_KEY and APP_SECRET below
 * 5. Run: node get-dropbox-refresh-token.js
 */

const readline = require('readline');
const https = require('https');
const { URLSearchParams } = require('url');

// ⚠️ REPLACE THESE WITH YOUR APP CREDENTIALS
const APP_KEY = '48vtrhbnil7frx9';  // From Dropbox App Console -> Settings
const APP_SECRET = '2dabbgbr0x5f6q7';  // From Dropbox App Console -> Settings

if (APP_KEY === 'YOUR_APP_KEY_HERE' || APP_SECRET === 'YOUR_APP_SECRET_HERE') {
  console.error('\n❌ ERROR: Please edit this file and set APP_KEY and APP_SECRET\n');
  console.error('Get these from: https://www.dropbox.com/developers/apps');
  console.error('Select your app → Settings tab → App key and App secret\n');
  process.exit(1);
}

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║   Dropbox OAuth Refresh Token Generator                 ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Step 1: Generate authorization URL
const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=code&token_access_type=offline`;

console.log('📋 STEP 1: Authorize the app\n');
console.log('Open this URL in your browser:\n');
console.log('🔗', authUrl);
console.log('\n');

// Step 2: Get authorization code from user
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('After authorizing, you\'ll get an authorization code.\n');
rl.question('📝 Paste the authorization code here: ', async (code) => {
  if (!code || code.trim() === '') {
    console.error('\n❌ No code provided. Exiting.\n');
    rl.close();
    process.exit(1);
  }

  console.log('\n🔄 Exchanging code for refresh token...\n');

  try {
    // Step 3: Exchange code for tokens
    const params = new URLSearchParams({
      code: code.trim(),
      grant_type: 'authorization_code',
      client_id: APP_KEY,
      client_secret: APP_SECRET,
    });

    const data = await httpsPost('api.dropboxapi.com', '/oauth2/token', params.toString());

    if (data.error) {
      console.error('❌ ERROR:', data.error_description || data.error);
      console.error('\nTroubleshooting:');
      console.error('- Make sure the authorization code is correct');
      console.error('- Code can only be used once - get a new one if needed');
      console.error('- Check APP_KEY and APP_SECRET are correct\n');
      process.exit(1);
    }

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

    console.log('ℹ️  IMPORTANT NOTES:');
    console.log('• Refresh token NEVER expires (until revoked)');
    console.log('• Your backend will automatically get new access tokens');
    console.log('• Keep these credentials secure!');
    console.log('• Remove DROPBOX_ACCESS_TOKEN from .env (not needed anymore)\n');

    console.log('📝 Current access token (expires in', data.expires_in, 'seconds):');
    console.log(data.access_token);
    console.log('\n✅ Setup complete! Your app will now work indefinitely.\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    rl.close();
  }
});

// Helper function for HTTPS POST
function httpsPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse response: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

