# 🔄 Dropbox Token Setup Guide (OAuth with Refresh Token)

## ⚠️ IMPORTANT: Why You Need This

**Dropbox now expires all manually generated tokens after 4 hours!**

- ❌ Manual tokens from console → Expire after 4 hours
- ✅ OAuth refresh tokens → **Never expire** (unless revoked)

Your backend will **automatically refresh** access tokens every 4 hours using the refresh token.

---

## 🚀 Setup Steps (One-Time)

### Step 1: Get Your App Credentials

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Select your app (or create one with "Full Dropbox" access)
3. Go to **Settings** tab
4. Copy these values:
   - **App key**
   - **App secret** (click "Show" to reveal)

### Step 2: Set Permissions

1. Go to **Permissions** tab
2. Enable ALL these:
   ```
   ✅ files.metadata.write
   ✅ files.metadata.read
   ✅ files.content.write
   ✅ files.content.read
   ✅ sharing.read
   ```
3. Click **"Submit"**

### Step 3: Edit the Token Generator Script

Open `get-dropbox-refresh-token.js` and replace:

```javascript
const APP_KEY = 'YOUR_APP_KEY_HERE';
const APP_SECRET = 'YOUR_APP_SECRET_HERE';
```

With your actual values from Step 1.

### Step 4: Run the Script

```bash
cd Shopify-backend
node get-dropbox-refresh-token.js
```

**Follow the prompts:**

1. Script will show a URL → Open it in your browser
2. Click **"Allow"** to authorize
3. You'll get an **authorization code**
4. Copy the code
5. Paste it in the terminal

**Output:**
The script will display your tokens. Add them to `.env`:

```bash
DROPBOX_APP_KEY=abcd1234...
DROPBOX_APP_SECRET=xyz789...
DROPBOX_REFRESH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxx
DROPBOX_ROOT_PATH=/Mülltonnenbeschriftungen
```

### Step 5: Remove Old Token (If Any)

If you have `DROPBOX_ACCESS_TOKEN` in your `.env`, **delete it**:

```bash
# Remove this line:
# DROPBOX_ACCESS_TOKEN=sl.xxxxx
```

You don't need it anymore!

### Step 6: Build and Deploy

```bash
npm run build
# Deploy your backend to production
```

---

## ✅ How It Works

### Automatic Token Refresh

Your backend now automatically:

1. **Uses refresh token** to get new access tokens
2. **Caches access tokens** for 4 hours
3. **Automatically refreshes** before expiration
4. **Never needs manual intervention**

### Token Lifecycle

```
Refresh Token (never expires)
    ↓
Access Token (valid 4 hours)
    ↓
[After ~3h 55min]
    ↓
Auto-refresh → New Access Token
    ↓
[Repeat forever]
```

---

## 🔧 Environment Variables

### Required for OAuth (Production)

```bash
DROPBOX_APP_KEY=your_app_key
DROPBOX_APP_SECRET=your_app_secret
DROPBOX_REFRESH_TOKEN=your_refresh_token
DROPBOX_ROOT_PATH=/Mülltonnenbeschriftungen
```

### Optional

```bash
# Only for Dropbox Business team folders
DROPBOX_PATH_ROOT=ns:1234567890
```

---

## 🧪 Testing

### Test Token Refresh

The backend will log token refreshes:

```
🔄 Refreshing Dropbox access token...
✅ Dropbox token refreshed successfully (expires in 14400 seconds)
```

### Check Upload Works

After setup, test an order:

1. Create a test order in Shopify
2. Check backend logs for successful upload
3. Verify PDFs appear in Dropbox at:
   ```
   /Mülltonnenbeschriftungen/2025-01-15/Order-123/
   ```

---

## 🔒 Security Notes

### Keep These Secret!

- ⚠️ **App Secret** - Never commit to git
- ⚠️ **Refresh Token** - Never expose publicly
- ✅ Use environment variables
- ✅ Add `.env` to `.gitignore`

### Token Permissions

The refresh token has these permissions:
- ✅ Access to all files in your Dropbox
- ✅ Can create/modify/delete files
- ⚠️ Keep it as secure as a password!

---

## 🐛 Troubleshooting

### "Failed to refresh Dropbox token"

**Causes:**
- Wrong `DROPBOX_APP_KEY` or `DROPBOX_APP_SECRET`
- Refresh token revoked
- App permissions changed

**Fix:**
1. Verify credentials in Dropbox console
2. Run `get-dropbox-refresh-token.js` again to get new token
3. Update `.env` file

### "Authorization code already used"

**Cause:** Each authorization code can only be used once

**Fix:** 
1. Go back to Step 4
2. Get a new authorization URL
3. Authorize again to get a new code

### Files upload to wrong folder

**Check:**
```bash
DROPBOX_ROOT_PATH=/Mülltonnenbeschriftungen
```

Make sure this matches your desired folder path.

### Token refresh not happening

**Check logs for:**
```
⚠️ WARNING: Using manual DROPBOX_ACCESS_TOKEN. This will expire after 4 hours!
```

If you see this, you're not using OAuth. Make sure `.env` has:
- `DROPBOX_REFRESH_TOKEN` (required)
- `DROPBOX_APP_KEY` (required)
- `DROPBOX_APP_SECRET` (required)

---

## 📊 Comparison: Manual vs OAuth

| Feature | Manual Token | OAuth Refresh Token |
|---------|-------------|---------------------|
| Expires | ❌ 4 hours | ✅ Never |
| Auto-refresh | ❌ No | ✅ Yes |
| Setup complexity | ✅ Simple | ⚠️ Moderate |
| Production-ready | ❌ No | ✅ Yes |
| Recommended | ❌ No | ✅ YES |

---

## ✅ Success Checklist

After setup, verify:

- [ ] `get-dropbox-refresh-token.js` ran successfully
- [ ] `.env` has all 4 required variables
- [ ] Backend builds without errors: `npm run build`
- [ ] Test order uploads PDFs to Dropbox
- [ ] Logs show token refresh happening
- [ ] No "token expired" errors after 4+ hours

---

## Need Help?

- [Dropbox OAuth Guide](https://www.dropbox.com/developers/reference/oauth-guide)
- [Token Management](https://www.dropbox.com/developers/reference/auth-types)

**Your backend will now work indefinitely without manual token updates!** 🎉

