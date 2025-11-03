/**
 * Get Dropbox namespace ID for team accounts
 * Run: node get-namespace-id.js
 */

require('dotenv').config();
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');

async function getNamespaceId() {
  const accessToken = process.env.DROPBOX_ACCESS_TOKEN;
  
  if (!accessToken) {
    console.error('\n❌ DROPBOX_ACCESS_TOKEN not found in .env');
    console.error('This script needs a valid access token\n');
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║        Dropbox Namespace ID Finder                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const dbx = new Dropbox({ accessToken, fetch });

  try {
    // Get current account info
    const result = await dbx.usersGetCurrentAccount();
    const data = result.result;

    console.log('📋 Account Information:\n');
    console.log('Name:', data.name.display_name);
    console.log('Email:', data.email);
    console.log('Account Type:', data.account_type['.tag']);
    
    if (data.team) {
      console.log('\n✅ This is a TEAM/BUSINESS account!');
      console.log('Team Name:', data.team.name);
    } else {
      console.log('\n✅ This is a PERSONAL account');
    }

    console.log('\n' + '─'.repeat(60) + '\n');
    console.log('🔧 Root Info:\n');
    
    if (data.root_info) {
      console.log('Root Type:', data.root_info['.tag']);
      console.log('Root Namespace ID:', data.root_info.root_namespace_id);
      console.log('Home Namespace ID:', data.root_info.home_namespace_id);
      
      console.log('\n' + '─'.repeat(60) + '\n');
      console.log('💡 SOLUTION:\n');
      
      if (data.account_type['.tag'] === 'business' || data.team) {
        console.log('Your files are in your personal folder because you have');
        console.log('a Dropbox Business account.\n');
        
        console.log('📝 Update your .env file:\n');
        console.log('Option 1 - Use full path (RECOMMENDED):');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`DROPBOX_ROOT_PATH=/Michael Steiger/Mülltonnenbeschriftungen`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        console.log('Option 2 - Use namespace (ADVANCED):');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`DROPBOX_PATH_ROOT=ns:${data.root_info.home_namespace_id}`);
        console.log(`DROPBOX_ROOT_PATH=/Mülltonnenbeschriftungen`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      } else {
        console.log('You have a personal account.');
        console.log('The path should work as-is: /Mülltonnenbeschriftungen\n');
      }
    } else {
      console.log('No root_info available');
    }

    console.log('\n📌 Current .env setting:');
    console.log('DROPBOX_ROOT_PATH=' + (process.env.DROPBOX_ROOT_PATH || '(not set)'));
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error:', error.error?.error_summary || error.message);
    
    if (error.error?.error_summary?.includes('expired')) {
      console.error('\n💡 Token expired! Get a new one or use refresh token.\n');
    }
  }
}

getNamespaceId();

