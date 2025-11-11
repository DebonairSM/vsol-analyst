# VSol Aurora Setup Guide

This guide explains how to configure the application to work with the custom DNS name `http://vsol-aurora` or any other custom hostname.

## Quick Setup

### 1. Update Environment Variables

Add or update the following in your `.env` file:

```env
# Server will listen on all network interfaces
HOST=0.0.0.0

# OAuth callback URL using your DNS name
CALLBACK_URL=http://vsol-aurora:5051/auth/google/callback
```

### 2. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to your project
3. Go to "APIs & Services" > "Credentials"
4. Edit your OAuth 2.0 Client ID
5. Add to "Authorized redirect URIs":
   - `http://vsol-aurora:5051/auth/google/callback`
6. Click "Save"

### 3. Restart the Application

```bash
npm run dev
```

The server will now accept connections from `http://vsol-aurora:5051`.

## Network Configuration

### DNS Setup

Ensure that `vsol-aurora` resolves to the correct IP address on your network:

**Windows (add to hosts file):**
```
# C:\Windows\System32\drivers\etc\hosts
192.168.1.100   vsol-aurora
```

Replace `192.168.1.100` with your server's actual IP address.

**Testing DNS resolution:**
```bash
ping vsol-aurora
```

## MCP Server Configuration

If you're using the MCP server with Cursor, update the API base URL to match your DNS name:

```json
{
  "mcpServers": {
    "sunny": {
      "command": "node",
      "args": ["C:\\git\\vsol-analyst\\dist\\mcp\\server-http.js"],
      "env": {
        "MCP_API_KEY": "your-api-key-here",
        "API_BASE_URL": "http://vsol-aurora:5051"
      }
    }
  }
}
```

**Note:** The MCP server must be able to reach the web server at the specified `API_BASE_URL`. If running MCP on a different machine, ensure network connectivity and that the HOST is set to `0.0.0.0` on the server.

## Supporting Multiple Hostnames

You can configure Google OAuth to support multiple hostnames simultaneously:

**Authorized redirect URIs:**
- `http://localhost:5051/auth/google/callback`
- `http://127.0.0.1:5051/auth/google/callback`
- `http://vsol-aurora:5051/auth/google/callback`
- `http://192.168.1.100:5051/auth/google/callback`

Set the `CALLBACK_URL` environment variable to match whichever hostname you're currently using.

## Troubleshooting

### "Invalid redirect URI" error

- Verify the `CALLBACK_URL` in `.env` exactly matches one of the authorized redirect URIs in Google Cloud Console
- Check for typos (http vs https, trailing slashes, port numbers)
- Wait a few minutes after updating Google Cloud Console settings

### Cannot connect to server

- Verify `HOST=0.0.0.0` is set in `.env`
- Check firewall rules allow incoming connections on port 5051
- Confirm DNS name resolves correctly: `ping vsol-aurora`
- Try accessing via IP address first to isolate DNS issues

### Session/authentication issues

- Clear browser cookies
- Ensure the domain in your browser matches the `CALLBACK_URL`
- Check that session cookies are being set correctly

## Security Considerations

When exposing the server on the network:

1. **Use HTTPS in production** - The current setup uses HTTP which is acceptable for private networks but not for public access
2. **Configure firewall rules** - Only allow connections from trusted network segments
3. **Use strong session secrets** - Ensure `SESSION_SECRET` is a long, random string
4. **Keep Google OAuth credentials secure** - Do not commit `.env` file to version control

## Production Deployment

For production use with custom domains:

1. Set up a reverse proxy (nginx or Apache) with HTTPS
2. Use a real domain name with SSL certificate
3. Update Google OAuth settings to use HTTPS callback URLs
4. Set `NODE_ENV=production` in environment variables
5. Configure session store (Redis) for multi-server deployments

