/**
 * Test Dropbox path and diagnose 400 errors
 * Run: node test-dropbox-path.js
 */

require('dotenv').config();
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');

async function testPath() {
  const rootPath = process.env.DROPBOX_ROOT_PATH || '/Mülltonnenbeschriftungen';
  
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║          Dropbox Path Tester & Fixer                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('Testing path:', rootPath);
  console.log('');

  // Check for potential issues
  const issues = [];
  
  if (rootPath.includes(' ')) {
    issues.push('⚠️  Path contains spaces');
  }
  if (rootPath.includes('ü') || rootPath.includes('ä') || rootPath.includes('ö')) {
    issues.push('⚠️  Path contains special characters (ü, ä, ö)');
  }
  if (!rootPath.startsWith('/')) {
    issues.push('❌ Path must start with /');
  }
  
  if (issues.length > 0) {
    console.log('🔍 Potential Issues Detected:\n');
    issues.forEach(issue => console.log(issue));
    console.log('');
  }

  // Try to get refresh token from dropbox-auth
  let accessToken;
  try {
    const { getDropboxAccessToken } = require('./src/dropbox-auth');
    accessToken = await getDropboxAccessToken();
    console.log('✅ Got access token via refresh\n');
  } catch (err) {
    accessToken = process.env.DROPBOX_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('❌ No access token available\n');
      process.exit(1);
    }
    console.log('✅ Using manual access token\n');
  }

  const dbx = new Dropbox({ accessToken, fetch });

  // Test 1: Can we access root?
  console.log('━'.repeat(60));
  console.log('TEST 1: Accessing Dropbox root\n');
  
  try {
    const result = await dbx.filesListFolder({ path: '' });
    console.log('✅ Can access root folder\n');
    console.log('Available folders:');
    result.result.entries
      .filter(e => e['.tag'] === 'folder')
      .slice(0, 5)
      .forEach(e => console.log('  📁', e.name));
    console.log('');
  } catch (err) {
    console.error('❌ Cannot access root:', err.error?.error_summary || err.message);
    console.log('');
  }

  // Test 2: Try various path formats
  console.log('━'.repeat(60));
  console.log('TEST 2: Testing different path formats\n');

  const pathsToTry = [
    rootPath,
    rootPath.replace(/ü/g, 'u').replace(/ä/g, 'a').replace(/ö/g, 'o'),
    '/Michael Steiger/Mulltonnenbeschriftungen',
    '/Mulltonnenbeschriftungen',
  ];

  for (const testPath of pathsToTry) {
    try {
      console.log(`Testing: ${testPath}`);
      const result = await dbx.filesGetMetadata({ path: testPath });
      console.log('  ✅ PATH WORKS! Use this one!\n');
      
      console.log('━'.repeat(60));
      console.log('\n💡 SOLUTION:\n');
      console.log('Update your .env file to:\n');
      console.log(`DROPBOX_ROOT_PATH=${testPath}\n`);
      console.log('━'.repeat(60));
      return;
      
    } catch (err) {
      const errorSummary = err.error?.error_summary || err.message;
      if (errorSummary.includes('not_found')) {
        console.log('  ❌ Folder not found');
      } else if (errorSummary.includes('400')) {
        console.log('  ❌ Invalid path format (400 error)');
      } else {
        console.log('  ❌', errorSummary);
      }
    }
  }

  console.log('\n━'.repeat(60));
  console.log('\n❌ None of the paths worked!\n');
  console.log('💡 Let\'s try creating a test folder...\n');

  // Test 3: Try creating a simple test folder
  console.log('━'.repeat(60));
  console.log('TEST 3: Creating test folder\n');

  const testFolders = [
    '/TestUpload',
    '/test-upload',
  ];

  for (const testFolder of testFolders) {
    try {
      console.log(`Creating: ${testFolder}`);
      await dbx.filesCreateFolderV2({ path: testFolder, autorename: false });
      console.log('  ✅ SUCCESS!\n');
      
      console.log('The issue is with your target path.');
      console.log('Your Dropbox can create folders, but the path you specified doesn\'t work.\n');
      console.log('💡 SOLUTIONS:\n');
      console.log('1. Use a simpler path without special characters:');
      console.log('   DROPBOX_ROOT_PATH=/Labels\n');
      console.log('2. Or create the folder manually in Dropbox first:');
      console.log(`   Go to Dropbox and create: ${rootPath}`);
      console.log('   Then try uploading again.\n');
      
      // Clean up test folder
      await dbx.filesDeleteV2({ path: testFolder });
      console.log('(Test folder cleaned up)\n');
      return;
      
    } catch (err) {
      console.log('  ❌', err.error?.error_summary || err.message);
    }
  }

  console.log('\n━'.repeat(60));
  console.log('\n💡 RECOMMENDATIONS:\n');
  console.log('1. Manually create the folder in Dropbox web interface');
  console.log('2. Use a simpler path: DROPBOX_ROOT_PATH=/Labels');
  console.log('3. Check your Dropbox permissions in app settings\n');
}

testPath().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error('\nStack:', err.stack);
});

