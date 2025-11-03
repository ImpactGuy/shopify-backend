/**
 * Get Dropbox Namespace ID to fix upload path
 * Run: node get-namespace-id.js
 */

require('dotenv').config();
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');

async function getNamespaceInfo() {
  const accessToken = process.env.DROPBOX_ACCESS_TOKEN || process.env.DROPBOX_REFRESH_TOKEN;
  
  if (!accessToken) {
    console.error('\n❌ No token found in .env file\n');
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         Dropbox Namespace ID Finder                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const dbx = new Dropbox({ accessToken, fetch });

  try {
    // Get current account info
    const accountInfo = await dbx.usersGetCurrentAccount();
    const account = accountInfo.result;

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
      console.log('Add this to your .env file:\n');
      console.log('DROPBOX_PATH_ROOT=' + account.root_info.root_namespace_id);
      console.log('');
      console.log('Your complete .env should look like:\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('DROPBOX_APP_KEY=...');
      console.log('DROPBOX_APP_SECRET=...');
      console.log('DROPBOX_REFRESH_TOKEN=...');
      console.log('DROPBOX_ROOT_PATH=/Mülltonnenbeschriftungen');
      console.log('DROPBOX_PATH_ROOT=' + account.root_info.root_namespace_id);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log('📌 This will make files upload to:');
      console.log('   /Mülltonnenbeschriftungen/');
      console.log('   Instead of: /Michael Steiger/Mülltonnenbeschriftungen/\n');

    } else {
      console.log('ℹ️  This is a Personal Dropbox account');
      console.log('Root Namespace ID:', account.root_info.root_namespace_id);
      console.log('');
      console.log('⚠️  Path issue might be something else.');
      console.log('Your files should already be uploading to the root.\n');
    }

    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Error:', error.error?.error_summary || error.message);
    
    if (error.message.includes('token')) {
      console.error('\n💡 Token expired or invalid. Get a new refresh token.\n');
    }
  }
}

getNamespaceInfo();

