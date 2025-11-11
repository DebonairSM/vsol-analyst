# Quick Setup Checklist for VSol Aurora Access

Use this checklist to configure the application for access via `http://vsol-aurora`.

## Configuration Steps

### 1. Environment Variables (.env file)

```env
# Ensure these settings are in your .env file:
HOST=0.0.0.0
CALLBACK_URL=http://vsol-aurora:5051/auth/google/callback
```

### 2. Google Cloud Console

- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Navigate to "APIs & Services" > "Credentials"
- [ ] Edit your OAuth 2.0 Client ID
- [ ] Add to "Authorized redirect URIs":
  - `http://vsol-aurora:5051/auth/google/callback`
- [ ] Save changes

### 3. DNS/Hosts File (if needed)

If `vsol-aurora` doesn't resolve on your network, add to hosts file:

**Windows:** `C:\Windows\System32\drivers\etc\hosts`
```
192.168.1.100   vsol-aurora
```
(Replace with your server's actual IP address)

### 4. Test DNS Resolution

```bash
ping vsol-aurora
```

Should respond with the correct IP address.

### 5. Restart Application

```bash
npm run dev
```

You should see:
```
VSol Analyst Agent running on:
  - http://localhost:5051
  - http://127.0.0.1:5051
  - http://vsol-aurora:5051 (if DNS configured)
```

### 6. Test Access

Open browser and navigate to:
```
http://vsol-aurora:5051
```

### 7. Test Login

Click "Sign in with Google" and verify OAuth flow works correctly.

## Verification

- [ ] Server starts without errors
- [ ] Can access application at `http://vsol-aurora:5051`
- [ ] Google OAuth login works
- [ ] Can create/view projects
- [ ] Session persists across page refreshes

## Troubleshooting

If something doesn't work, see the full [VSol Aurora Setup Guide](VSOL-AURORA-SETUP.md) for detailed troubleshooting steps.

## Common Issues

**"Invalid redirect URI"**
- Double-check `CALLBACK_URL` in .env exactly matches Google Cloud Console
- Wait a few minutes after updating Google OAuth settings

**Cannot connect**
- Verify `HOST=0.0.0.0` in .env
- Check firewall allows port 5051
- Confirm DNS resolution with `ping vsol-aurora`

**Session issues**
- Clear browser cookies
- Verify accessing via the same hostname as `CALLBACK_URL`

