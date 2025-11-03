/**
 * Interactive Dropbox Refresh Token Generator
 * Run: node get-refresh-token-interactive.js
 */

const readline = require('readline');

const APP_KEY = '48vtrhbnil7frx9';
const APP_SECRET = '2dabbgbr0x5f6q7';
const AUTH_URL = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=code&token_access_type=offline`;

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║   🔄 Dropbox Refresh Token Generator                    ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log('📋 STEP 1: Get Authorization Code\n');
console.log('Open this URL in your browser:\n');
console.log('🔗', AUTH_URL);
console.log('\n');
console.log('After clicking "Allow", you\'ll get an authorization code.\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('📝 Paste the authorization code here: ', async (code) => {
  if (!code || code.trim() === '') {
    console.error('\n❌ No code provided. Exiting.\n');
    rl.close();
    process.exit(1);
  }

  console.log('\n🔄 Exchanging code for refresh token...\n');

  try {
    const params = new URLSearchParams({
      code: code.trim(),
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
      const errorText = await response.text();
      console.error('❌ ERROR:', errorText);
      
      if (errorText.includes('invalid_grant')) {
        console.error('\n⚠️  Authorization code expired or already used!');
        console.error('Get a new code from:', AUTH_URL, '\n');
      }
      rl.close();
      process.exit(1);
    }

    const data = await response.json();

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                   ✅ SUCCESS!                            ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log('📝 Add these to your .env file:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`DROPBOX_APP_KEY=${APP_KEY}`);
    console.log(`DROPBOX_APP_SECRET=${APP_SECRET}`);
    console.log(`DROPBOX_REFRESH_TOKEN=${data.refresh_token}`);
    console.log(`DROPBOX_ROOT_PATH=/Michael Steiger/Mülltonnenbeschriftungen`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('ℹ️  IMPORTANT NOTES:');
    console.log('• Refresh token NEVER expires (until revoked) ✅');
    console.log('• Your backend will auto-refresh access tokens ✅');
    console.log('• Remove old DROPBOX_ACCESS_TOKEN from .env ✅');
    console.log('');
    console.log('📌 Next steps:');
    console.log('1. Update .env file with the values above');
    console.log('2. Run: npm run build');
    console.log('3. Deploy your backend');
    console.log('4. Test: node test-dropbox-upload.js\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.message.includes('fetch') || error.message.includes('ETIMEDOUT')) {
      console.error('\n💡 Network issue. Try:');
      console.error('1. Different network (mobile hotspot)');
      console.error('2. Use PowerShell method (see below)');
      console.error('3. Open dropbox-token-generator.html in browser\n');
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('PowerShell Alternative:\n');
      console.log('$body = @{');
      console.log(`    code = "${code.trim()}"`);
      console.log('    grant_type = "authorization_code"');
      console.log(`    client_id = "${APP_KEY}"`);
      console.log(`    client_secret = "${APP_SECRET}"`);
      console.log('}');
      console.log('$response = Invoke-RestMethod -Uri "https://api.dropboxapi.com/oauth2/token" -Method Post -Body $body');
      console.log('Write-Host "Refresh Token:" $response.refresh_token');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
  } finally {
    rl.close();
  }
});

