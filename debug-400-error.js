/**
 * Debug 400 error in detail
 * Run: node debug-400-error.js
 */

require('dotenv').config();
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');
const { getDropboxAccessToken } = require('./src/dropbox-auth');

async function debug() {
  const rootPath = process.env.DROPBOX_ROOT_PATH || '/Labels';
  
  console.log('\n🔍 Debugging 400 Error\n');
  console.log('Path from .env:', rootPath);
  console.log('');

  try {
    const accessToken = await getDropboxAccessToken();
    console.log('✅ Token obtained\n');

    const dbx = new Dropbox({ accessToken, fetch });

    // Try to create the folder
    console.log('Attempting to create folder:', rootPath);
    console.log('');

    try {
      const result = await dbx.filesCreateFolderV2({ 
        path: rootPath, 
        autorename: false 
      });
      console.log('✅ Folder created successfully!');
      console.log('Folder path:', result.result.metadata.path_display);
      
    } catch (createError) {
      console.log('❌ Folder creation failed\n');
      
      // Get detailed error
      if (createError.error) {
        console.log('Error details:');
        console.log('Status:', createError.status);
        console.log('Error:', createError.error);
        console.log('');
        
        const errorSummary = createError.error.error_summary || '';
        
        if (errorSummary.includes('path/conflict')) {
          console.log('💡 Folder already exists - this is OK!');
          console.log('Trying to upload a test file...\n');
          
          // Try upload
          const testPath = `${rootPath}/test-${Date.now()}.txt`;
          try {
            await dbx.filesUpload({
              path: testPath,
              contents: 'Test upload',
              mode: { '.tag': 'add' }
            });
            console.log('✅ Upload works! Your setup is correct.');
            console.log('File created at:', testPath);
            
          } catch (uploadError) {
            console.log('❌ Upload failed:', uploadError.error?.error_summary);
            
            if (uploadError.error?.error_summary?.includes('path')) {
              console.log('\n💡 PATH IS THE PROBLEM\n');
              console.log('Your path has invalid characters or format.');
              console.log('\nTry these in .env:\n');
              console.log('1. DROPBOX_ROOT_PATH=/Labels');
              console.log('2. DROPBOX_ROOT_PATH=/Mulltonnenbeschriftungen (no ü)');
              console.log('3. DROPBOX_ROOT_PATH=/MulltonnenbeschriftungenTest\n');
            }
          }
          
        } else if (errorSummary.includes('path/')) {
          console.log('💡 PATH FORMAT ERROR\n');
          console.log('The path format is invalid.');
          console.log('Current path:', rootPath);
          console.log('\nIssues detected:');
          if (!rootPath.startsWith('/')) {
            console.log('- ❌ Path must start with /');
          }
          if (rootPath.includes('ü') || rootPath.includes('ä') || rootPath.includes('ö')) {
            console.log('- ⚠️  Contains German umlauts (ü, ä, ö)');
            console.log('  Try without: Mülltonnenbeschriftungen → Mulltonnenbeschriftungen');
          }
          if (rootPath.includes('  ')) {
            console.log('- ❌ Contains double spaces');
          }
          
          console.log('\n✅ SOLUTION:\n');
          console.log('Update .env to:');
          console.log('DROPBOX_ROOT_PATH=/Labels\n');
          console.log('Then manually create the "Labels" folder in Dropbox.\n');
          
        } else {
          console.log('Unknown error:', errorSummary);
        }
        
      } else {
        console.log('Error:', createError.message);
      }
    }

  } catch (err) {
    console.error('❌ Fatal error:', err.message);
  }
}

debug();

