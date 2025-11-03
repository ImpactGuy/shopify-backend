/**
 * Test if Dropbox token works at all
 * Run: node test-token-only.js
 */

require('dotenv').config();
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');

async function testToken() {
  console.log('\n🔍 Testing Dropbox Connection\n');

  // Get token - handle refresh token manually since .ts files aren't compiled yet
  let accessToken;
  
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  
  if (refreshToken && appKey && appSecret) {
    console.log('🔄 Refreshing access token...\n');
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: appKey,
        client_secret: appSecret,
      });

      const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed: ' + await response.text());
      }

      const data = await response.json();
      accessToken = data.access_token;
      console.log('✅ Got access token via refresh\n');
      
    } catch (err) {
      console.error('❌ Token refresh failed:', err.message);
      console.error('\n💡 Your refresh token might be invalid.');
      console.error('   Run: node get-refresh-token-interactive.js\n');
      process.exit(1);
    }
  } else if (process.env.DROPBOX_ACCESS_TOKEN) {
    accessToken = process.env.DROPBOX_ACCESS_TOKEN;
    console.log('✅ Using manual access token\n');
  } else {
    console.error('❌ No Dropbox token found!\n');
    console.error('💡 Your .env needs:');
    console.error('   DROPBOX_APP_KEY=48vtrhbnil7frx9');
    console.error('   DROPBOX_APP_SECRET=2dabbgbr0x5f6q7');
    console.error('   DROPBOX_REFRESH_TOKEN=<your_token>\n');
    console.error('Run: node get-refresh-token-interactive.js\n');
    process.exit(1);
  }

  const dbx = new Dropbox({ accessToken, fetch });

  // Test 1: Can we access Dropbox at all?
  console.log('━'.repeat(60));
  console.log('TEST 1: Basic Dropbox Access\n');
  
  try {
    const account = await dbx.usersGetCurrentAccount();
    console.log('✅ Connected to Dropbox!');
    console.log('Account:', account.result.name.display_name);
    console.log('Email:', account.result.email);
    console.log('');
  } catch (err) {
    console.error('❌ Cannot connect:', err.message);
    process.exit(1);
  }

  // Test 2: Can we list root folder?
  console.log('━'.repeat(60));
  console.log('TEST 2: List Root Folder\n');
  
  try {
    const result = await dbx.filesListFolder({ path: '' });
    console.log('✅ Can list root folder');
    console.log('Found', result.result.entries.length, 'items\n');
    
    console.log('Folders in root:');
    result.result.entries
      .filter(e => e['.tag'] === 'folder')
      .slice(0, 10)
      .forEach(e => console.log('  📁', e.path_display));
    console.log('');
  } catch (err) {
    console.error('❌ Cannot list:', err.message);
  }

  // Test 3: Can we create a simple folder?
  console.log('━'.repeat(60));
  console.log('TEST 3: Create Simple Test Folder\n');
  
  const testPath = '/TestFolder' + Date.now();
  
  try {
    await dbx.filesCreateFolderV2({ path: testPath });
    console.log('✅ Can create folders!');
    console.log('Created:', testPath);
    
    // Upload a test file
    const filePath = `${testPath}/test.txt`;
    await dbx.filesUpload({
      path: filePath,
      contents: 'Test file content',
      mode: { '.tag': 'add' }
    });
    console.log('✅ Can upload files!');
    console.log('Uploaded:', filePath);
    
    // Clean up
    await dbx.filesDeleteV2({ path: testPath });
    console.log('✅ Test successful (cleaned up)\n');
    
    console.log('━'.repeat(60));
    console.log('\n✅ YOUR DROPBOX CONNECTION WORKS!\n');
    console.log('The 400 error is coming from your path configuration.');
    console.log('\n💡 SOLUTION:\n');
    console.log('Your .env should have:');
    console.log('DROPBOX_ROOT_PATH=/Labels\n');
    console.log('Then create a folder called "Labels" in Dropbox:\n');
    console.log('https://www.dropbox.com/home\n');
    
  } catch (err) {
    console.error('❌ Cannot create folder:', err.error?.error_summary || err.message);
    
    if (err.error?.error_summary?.includes('insufficient_permissions')) {
      console.error('\n💡 PERMISSION ISSUE!\n');
      console.error('Your Dropbox app needs more permissions:');
      console.error('1. Go to: https://www.dropbox.com/developers/apps');
      console.error('2. Select your app');
      console.error('3. Permissions tab → Enable:');
      console.error('   ✅ files.content.write');
      console.error('   ✅ files.content.read');
      console.error('   ✅ files.metadata.write');
      console.error('   ✅ files.metadata.read');
      console.error('4. Click Submit');
      console.error('5. Get NEW refresh token!\n');
    }
  }
}

testToken();

