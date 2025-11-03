/**
 * Dropbox OAuth Token Management
 * Automatically refreshes expired access tokens using refresh token
 */

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
}

let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get a valid Dropbox access token
 * Automatically refreshes if expired using refresh token
 */
export async function getDropboxAccessToken(): Promise<string> {
  // If using OAuth with refresh token (RECOMMENDED for production)
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  
  if (refreshToken) {
    // Check if cached token is still valid (with 5 minute buffer)
    const now = Date.now();
    if (cachedAccessToken && tokenExpiresAt > now + 5 * 60 * 1000) {
      return cachedAccessToken;
    }

    // Refresh the token
    console.log('🔄 Refreshing Dropbox access token...');
    const appKey = process.env.DROPBOX_APP_KEY;
    const appSecret = process.env.DROPBOX_APP_SECRET;

    if (!appKey || !appSecret) {
      throw new Error('DROPBOX_APP_KEY and DROPBOX_APP_SECRET required for token refresh');
    }

    const fetchImpl = (global as any).fetch || (globalThis as any).fetch;
    const response = await fetchImpl('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: appKey,
        client_secret: appSecret,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh Dropbox token: ${error}`);
    }

    const data: TokenResponse = await response.json();
    
    cachedAccessToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000);

    console.log('✅ Dropbox token refreshed successfully (expires in', data.expires_in, 'seconds)');
    return cachedAccessToken;
  }

  // Fallback to manual token (will expire after 4 hours!)
  const manualToken = process.env.DROPBOX_ACCESS_TOKEN;
  if (manualToken) {
    console.warn('⚠️ WARNING: Using manual DROPBOX_ACCESS_TOKEN. This will expire after 4 hours!');
    console.warn('⚠️ For production, set up OAuth with DROPBOX_REFRESH_TOKEN instead.');
    return manualToken;
  }

  throw new Error('Either DROPBOX_REFRESH_TOKEN or DROPBOX_ACCESS_TOKEN must be set');
}

/**
 * Clear cached token (useful for testing)
 */
export function clearCachedToken(): void {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}

