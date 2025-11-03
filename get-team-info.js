/**
 * Get Dropbox Team information and namespace IDs
 * Run: node get-team-info.js
 */

require('dotenv').config();
const https = require('https');

async function getTeamInfo() {
  const accessToken = process.env.DROPBOX_ACCESS_TOKEN;
  
  if (!accessToken) {
    console.error('\n❌ DROPBOX_ACCESS_TOKEN not found in .env\n');
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║           Dropbox Team & Namespace Info                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    // Get current account info
    const accountData = await makeRequest('/2/users/get_current_account', accessToken, {});
    
    console.log('👤 Account Information:\n');
    console.log('Name:', accountData.name.display_name);
    console.log('Email:', accountData.email);
    console.log('Account Type:', accountData.account_type['.tag']);
    
    if (accountData.team) {
      console.log('\n🏢 Team Information:\n');
      console.log('Team Name:', accountData.team.name);
      console.log('Team ID:', accountData.team.id);
    }
    
    console.log('\n📂 Namespace Information:\n');
    console.log('Root Type:', accountData.root_info['.tag']);
    console.log('Root Namespace ID:', accountData.root_info.root_namespace_id);
    console.log('Home Namespace ID:', accountData.root_info.home_namespace_id);

    // List all available namespaces
    console.log('\n🔍 Checking available namespaces...\n');
    
    const namespacesData = await makeRequest('/2/users/get_space_usage', accessToken, {});
    
    if (namespacesData.allocation) {
      console.log('Space Allocation:', namespacesData.allocation['.tag']);
    }

    // Try to list team folders
    console.log('\n📁 Team Folders:\n');
    
    try {
      // Try listing folders at root with team namespace
      const teamRoot = `ns:${accountData.root_info.root_namespace_id}`;
      console.log('Using team root namespace:', teamRoot);
      
      const foldersData = await makeRequest('/2/files/list_folder', accessToken, {
        path: '',
      });
      
      console.log('\nFolders found:\n');
      foldersData.entries.forEach(entry => {
        const icon = entry['.tag'] === 'folder' ? '📁' : '📄';
        console.log(`${icon} ${entry.name}`);
        console.log(`   Path: ${entry.path_display}`);
      });

    } catch (err) {
      console.log('Could not list team folders');
    }

    console.log('\n' + '━'.repeat(60) + '\n');
    console.log('💡 CONFIGURATION OPTIONS:\n');
    
    console.log('Option 1 - Personal Folder (Current):\n');
    console.log('DROPBOX_ROOT_PATH=/Michael Steiger/Mülltonnenbeschriftungen\n');
    
    console.log('Option 2 - Team Root Folder:\n');
    console.log('DROPBOX_PATH_ROOT=ns:' + accountData.root_info.root_namespace_id);
    console.log('DROPBOX_ROOT_PATH=/Team Folder Name/Mülltonnenbeschriftungen\n');
    
    console.log('Option 3 - Team Shared Folder:\n');
    console.log('DROPBOX_ROOT_PATH=/Shared/Mülltonnenbeschriftungen');
    console.log('# (Check the exact folder name in your Dropbox)\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

// Helper function to make Dropbox API requests
function makeRequest(endpoint, token, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    
    const options = {
      hostname: 'api.dropboxapi.com',
      path: endpoint,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse response: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

getTeamInfo();

