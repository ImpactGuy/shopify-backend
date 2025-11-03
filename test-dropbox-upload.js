/**
 * Test Dropbox upload path
 * Run: node test-dropbox-upload.js
 */

require('dotenv').config();
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');

async function testUpload() {
  const accessToken = process.env.DROPBOX_ACCESS_TOKEN;
  const rootPath = process.env.DROPBOX_ROOT_PATH || '/Labels';
  
  if (!accessToken) {
    console.error('❌ DROPBOX_ACCESS_TOKEN not set in .env file');
    process.exit(1);
  }

  console.log('=== Dropbox Upload Test ===\n');
  console.log('Root Path from .env:', rootPath);
  console.log('Token:', accessToken.substring(0, 10) + '...');
  console.log('\n📂 Files will upload to:', rootPath);
  console.log('🔗 Check here:', `https://www.dropbox.com/home${rootPath}\n`);

  const dbx = new Dropbox({ accessToken, fetch });

  // Test file content
  const testContent = `Test upload at ${new Date().toISOString()}`;
  const testPath = `${rootPath}/test-${Date.now()}.txt`;

  try {
    console.log('Uploading test file to:', testPath);
    
    const result = await dbx.filesUpload({
      path: testPath,
      contents: testContent,
      mode: { '.tag': 'add' },
    });

    console.log('\n✅ Upload successful!');
    console.log('File uploaded to:', result.result.path_display);
    console.log('File ID:', result.result.id);
    console.log('\nCheck your Dropbox at:', `https://www.dropbox.com/home${result.result.path_display}`);
    
    // Try to list files in the root path
    console.log('\n=== Files in root folder ===');
    const listResult = await dbx.filesListFolder({ path: rootPath });
    
    if (listResult.result.entries.length === 0) {
      console.log('(Folder is empty or newly created)');
    } else {
      listResult.result.entries.forEach(entry => {
        console.log('-', entry.name, `(${entry['.tag']})`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Upload failed!');
    console.error('Error:', error.error?.error_summary || error.message);
    
    if (error.error?.error_summary?.includes('path/not_found')) {
      console.error('\n💡 Folder not found. Make sure the path exists in your Dropbox.');
      console.error('   Or the app will create it on first upload.');
    }
    
    if (error.error?.error_summary?.includes('insufficient_permissions')) {
      console.error('\n💡 Insufficient permissions. Make sure your app has:');
      console.error('   - "Full Dropbox" access (not "App folder")');
      console.error('   - files.content.write permission enabled');
    }
  }
}

testUpload();

