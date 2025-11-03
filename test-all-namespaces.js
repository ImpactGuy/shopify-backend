/**
 * Test all possible namespace configurations to find the right one
 * Run: node test-all-namespaces.js
 */

require('dotenv').config();
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');

async function testNamespace(pathRoot, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`   pathRoot: ${pathRoot || '(none)'}`);
  
  try {
    // Get token (with refresh if available)
    let accessToken = process.env.DROPBOX_ACCESS_TOKEN;
    
    // If using refresh token, we need to use the auth module
    if (!accessToken && process.env.DROPBOX_REFRESH_TOKEN) {
      console.log('   (Using refresh token to get access token)');
      // For simplicity, let's just require a direct token for this test
      accessToken = process.env.DROPBOX_REFRESH_TOKEN;
    }
    
    if (!accessToken) {
      console.log('   ❌ No token found');
      return false;
    }

    const config = { accessToken, fetch };
    if (pathRoot) {
      config.pathRoot = pathRoot;
    }
    
    const dbx = new Dropbox(config);
    const testPath = '/Mülltonnenbeschriftungen';
    
    // Try to list folder
    const result = await dbx.filesListFolder({ path: testPath });
    
    console.log(`   ✅ SUCCESS! This configuration works!`);
    console.log(`   Found ${result.result.entries.length} items in folder`);
    
    // Try to upload a test file
    const testContent = `Test file at ${new Date().toISOString()}`;
    const uploadPath = `${testPath}/namespace-test-${Date.now()}.txt`;
    
    await dbx.filesUpload({
      path: uploadPath,
      contents: testContent,
      mode: { '.tag': 'add' }
    });
    
    console.log(`   ✅ Test file uploaded successfully!`);
    console.log(`   📂 Check: https://www.dropbox.com/home/Mülltonnenbeschriftungen`);
    console.log(`\n   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   📋 ADD THIS TO YOUR .env FILE:`);
    if (pathRoot) {
      console.log(`   DROPBOX_PATH_ROOT=${pathRoot}`);
    } else {
      console.log(`   (No DROPBOX_PATH_ROOT needed - remove it from .env)`);
    }
    console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return true;
    
  } catch (error) {
    const errorMsg = error.error?.error_summary || error.message;
    console.log(`   ❌ Failed: ${errorMsg}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     Dropbox Namespace Configuration Finder              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  console.log('Current .env settings:');
  console.log('DROPBOX_ROOT_PATH:', process.env.DROPBOX_ROOT_PATH || '(not set)');
  console.log('DROPBOX_PATH_ROOT:', process.env.DROPBOX_PATH_ROOT || '(not set)');
  
  const configurations = [
    [null, 'Default (no pathRoot)'],
    ['root', 'Using "root"'],
    ['{".tag": "root"}', 'Using root object'],
    ['team_root', 'Using "team_root"'],
  ];
  
  console.log('\n' + '═'.repeat(60));
  console.log('Testing different namespace configurations...');
  console.log('═'.repeat(60));
  
  for (const [pathRoot, description] of configurations) {
    const success = await testNamespace(pathRoot, description);
    if (success) {
      console.log('\n🎉 FOUND THE RIGHT CONFIGURATION!');
      console.log('Update your .env file with the setting shown above.\n');
      return;
    }
  }
  
  console.log('\n❌ None of the standard configurations worked.\n');
  console.log('💡 Possible solutions:');
  console.log('1. Make sure you have "Full Dropbox" access (not "App folder")');
  console.log('2. Try moving the folder in Dropbox from:');
  console.log('   /Michael Steiger/Mülltonnenbeschriftungen');
  console.log('   TO');
  console.log('   /Mülltonnenbeschriftungen');
  console.log('3. Or just accept the current path and update .env:');
  console.log('   DROPBOX_ROOT_PATH=/Michael Steiger/Mülltonnenbeschriftungen\n');
}

runAllTests().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
});

