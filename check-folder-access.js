/**
 * Check which folders you can access and their sharing status
 * Run: node check-folder-access.js
 */

require('dotenv').config();
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');

async function checkAccess() {
  const accessToken = process.env.DROPBOX_ACCESS_TOKEN;
  const rootPath = process.env.DROPBOX_ROOT_PATH || '/Mülltonnenbeschriftungen';
  
  if (!accessToken) {
    console.error('\n❌ DROPBOX_ACCESS_TOKEN not found\n');
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         Folder Access & Sharing Status Check            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const dbx = new Dropbox({ accessToken, fetch });

  try {
    // Check the folder we're trying to use
    console.log('📂 Checking folder:', rootPath, '\n');
    
    const folderMeta = await dbx.filesGetMetadata({ path: rootPath });
    const folder = folderMeta.result;
    
    console.log('✅ Folder found!\n');
    console.log('Name:', folder.name);
    console.log('Path:', folder.path_display);
    console.log('ID:', folder.id);
    
    if (folder.sharing_info) {
      console.log('\n👥 Sharing Info:');
      console.log('Shared:', folder.sharing_info.read_only ? 'Yes (Read-Only)' : 'Yes');
      console.log('Shared Folder ID:', folder.sharing_info.shared_folder_id);
      console.log('Team Folder:', folder.sharing_info.traverse_only ? 'Yes' : 'No');
    } else {
      console.log('\n👤 This is a PERSONAL folder (not shared)');
    }

    // List root folders to see team folders
    console.log('\n' + '─'.repeat(60));
    console.log('\n📁 Available Root Folders:\n');
    
    const rootList = await dbx.filesListFolder({ path: '' });
    
    rootList.result.entries.forEach(entry => {
      if (entry['.tag'] === 'folder') {
        const isShared = entry.sharing_info ? '👥 SHARED' : '👤 Personal';
        console.log(`📁 ${entry.name}`);
        console.log(`   ${isShared}`);
        console.log(`   Path: ${entry.path_display}\n`);
      }
    });

    console.log('─'.repeat(60));
    console.log('\n💡 RECOMMENDATIONS:\n');
    
    if (!folder.sharing_info) {
      console.log('⚠️  Your upload folder is PERSONAL (not shared with team)\n');
      console.log('To share with team:');
      console.log('1. Go to Dropbox web');
      console.log('2. Right-click the folder:', rootPath);
      console.log('3. Select "Share"');
      console.log('4. Share with your team\n');
      console.log('OR move the folder to a team shared location.\n');
    } else {
      console.log('✅ Your upload folder is SHARED with the team!\n');
      console.log('All team members can access uploaded files.\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.error?.error_summary || error.message);
    
    if (error.error?.error_summary?.includes('not_found')) {
      console.error('\n💡 Folder not found:', rootPath);
      console.error('\nTry these paths instead:');
      console.error('- /Michael Steiger/Mülltonnenbeschriftungen');
      console.error('- /Team Folder Name/Mülltonnenbeschriftungen');
      console.error('- /Shared/Mülltonnenbeschriftungen\n');
    }
  }
}

checkAccess();

