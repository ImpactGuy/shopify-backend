/**
 * Diagnostic script to find where Dropbox files are uploading
 * Run: node find-my-files.js
 */

require('dotenv').config();
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');

async function findFiles() {
  const accessToken = process.env.DROPBOX_ACCESS_TOKEN || process.env.DROPBOX_REFRESH_TOKEN;
  const rootPath = process.env.DROPBOX_ROOT_PATH || '/Labels';
  
  if (!accessToken) {
    console.error('\n❌ No Dropbox token found in .env file');
    console.error('Need either DROPBOX_ACCESS_TOKEN or DROPBOX_REFRESH_TOKEN\n');
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║          Dropbox Upload Location Finder                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('📋 Your Configuration:\n');
  console.log('DROPBOX_ROOT_PATH:', rootPath);
  console.log('Has Token:', accessToken ? '✅ Yes' : '❌ No');
  console.log('\n' + '─'.repeat(60) + '\n');

  const dbx = new Dropbox({ accessToken, fetch });

  // Check multiple possible locations
  const possiblePaths = [
    rootPath,
    '/Labels',
    '/Mülltonnenbeschriftungen',
    '/Michael Steiger/Labels',
    '/Michael Steiger/Mülltonnenbeschriftungen',
  ];

  console.log('🔍 Searching for files in common locations...\n');

  for (const path of possiblePaths) {
    try {
      const result = await dbx.filesListFolder({ path });
      
      if (result.result.entries.length > 0) {
        console.log('✅ FOUND FILES HERE:', path);
        console.log('   Files/Folders:');
        result.result.entries.forEach(entry => {
          console.log('   -', entry.name, `(${entry['.tag']})`);
        });
        console.log('   🔗 View:', `https://www.dropbox.com/home${path}`);
        console.log('');
      } else {
        console.log('📂 Empty folder:', path);
      }
    } catch (error) {
      if (error.error?.error_summary?.includes('path/not_found')) {
        console.log('❌ Not found:', path);
      } else {
        console.log('⚠️  Error checking', path, ':', error.error?.error_summary || error.message);
      }
    }
  }

  console.log('\n' + '─'.repeat(60) + '\n');
  console.log('📌 SUMMARY:\n');
  console.log('Expected upload path:', rootPath);
  console.log('Full path structure:');
  console.log(`  ${rootPath}/<DATE>/<ORDER_NAME>/label-xxx.pdf`);
  console.log('\nExample:');
  console.log(`  ${rootPath}/2025-01-15/Order-1001/label-cfg-1.pdf\n`);

  console.log('💡 TIP: If files are not in the expected location,');
  console.log('check your .env file and make sure DROPBOX_ROOT_PATH is set correctly.\n');
}

findFiles().catch(err => {
  console.error('\n❌ Error:', err.message);
  
  if (err.message.includes('token')) {
    console.error('\n💡 Token issue. Make sure you have a valid Dropbox token in .env\n');
  }
});

