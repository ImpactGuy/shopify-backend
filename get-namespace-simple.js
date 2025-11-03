/**
 * Get Dropbox Namespace ID - Simple version (no dependencies)
 * 
 * USAGE:
 * 1. Edit line 10 - paste your token
 * 2. Run: node get-namespace-simple.js
 */

// ⚠️ PASTE YOUR TOKEN HERE (from .env file)
const DROPBOX_TOKEN = 'PASTE_YOUR_TOKEN_HERE';

async function getNamespaceInfo() {
  if (DROPBOX_TOKEN === 'PASTE_YOUR_TOKEN_HERE') {
    console.error('\n❌ ERROR: Please edit this file and paste your Dropbox token on line 10\n');
    console.error('Find your token in: Shopify-backend/.env');
    console.error('Look for: DROPBOX_ACCESS_TOKEN or DROPBOX_REFRESH_TOKEN\n');
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         Dropbox Namespace ID Finder                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log('🔄 Fetching account info...\n');

  try {
    const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ API Error:', error);
      
      if (error.includes('invalid_access_token')) {
        console.error('\n💡 Token is invalid or expired.');
        console.error('Get a new token using the refresh token setup.\n');
      }
      process.exit(1);
    }

    const account = await response.json();

    console.log('📋 Account Information:\n');
    console.log('Name:', account.name.display_name);
    console.log('Email:', account.email);
    console.log('Account Type:', account.account_type['.tag']);
    console.log('');

    if (account.account_type['.tag'] === 'business') {
      console.log('✅ This is a Dropbox Business account\n');
      console.log('Root Info:');
      console.log('- Root Namespace ID:', account.root_info.root_namespace_id);
      console.log('- Home Namespace ID:', account.root_info.home_namespace_id);
      console.log('');

      console.log('═══════════════════════════════════════════════════════════\n');
      console.log('🔧 TO FIX YOUR UPLOAD PATH:\n');
      console.log('Add this line to your .env file:\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('DROPBOX_PATH_ROOT=' + account.root_info.root_namespace_id);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log('Your complete .env should have these lines:\n');
      console.log('DROPBOX_APP_KEY=48vtrhbnil7frx9');
      console.log('DROPBOX_APP_SECRET=2dabbgbr0x5f6q7');
      console.log('DROPBOX_REFRESH_TOKEN=...');
      console.log('DROPBOX_ROOT_PATH=/Mülltonnenbeschriftungen');
      console.log('DROPBOX_PATH_ROOT=' + account.root_info.root_namespace_id);
      console.log('');

      console.log('📌 After adding this, files will upload to:');
      console.log('   /Mülltonnenbeschriftungen/');
      console.log('   NOT /Michael Steiger/Mülltonnenbeschriftungen/\n');

      console.log('🚀 Next steps:');
      console.log('1. Add DROPBOX_PATH_ROOT to .env file');
      console.log('2. Run: npm run build');
      console.log('3. Deploy your backend');
      console.log('4. Test: node test-dropbox-upload.js\n');

    } else {
      console.log('ℹ️  This is a Personal Dropbox account');
      console.log('Root Namespace ID:', account.root_info.root_namespace_id);
      console.log('');
      console.log('⚠️  Your path issue might be something else.');
      console.log('Files should already be uploading to the root.\n');
    }

    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('fetch') || error.message.includes('network')) {
      console.error('\n💡 Network error. Try:');
      console.error('1. Check internet connection');
      console.error('2. Try on different network');
      console.error('3. Use VPN if needed\n');
    }
  }
}

getNamespaceInfo();

