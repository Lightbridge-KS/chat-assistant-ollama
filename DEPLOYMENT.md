# Hospital Deployment Guide

This guide is for the hospital IT team to deploy the Ollama Chat application to the nginx server.

## Deployment Overview

**Application URL:** `http://10.6.34.95/radchat`
**Nginx Server:** `10.6.34.95`
**Ollama Server:** `http://10.6.135.213:80`

## Architecture

```
User Browser
  ↓ http://10.6.34.95/radchat
Nginx Server (10.6.34.95)
  ├─ /radchat/            → Serve static files
  └─ /radchat/api/ollama/ → Proxy to Ollama server
       ↓
Ollama Server (10.6.135.213:80)
```

The application is a **pure static export** (HTML/CSS/JS) that runs entirely in the browser. No Node.js runtime is required on the server.

## Deployment Steps

### 1. Extract Static Files

Extract the build artifact `ollama-chat-{version}.zip` to the nginx web root:

```bash
# Example: Extract to /var/www/radchat
sudo mkdir -p /var/www/radchat
cd /var/www/radchat
sudo unzip /path/to/ollama-chat-{version}.zip
```

**Important:** The contents should be directly in `/var/www/radchat/`, not in a subdirectory.

Expected structure:
```
/var/www/radchat/
├── index.html
├── _next/
│   ├── static/
│   └── ...
├── fonts/
└── ...
```

### 2. Configure Nginx

Add the following configuration to your nginx config file (usually `/etc/nginx/sites-available/default` or `/etc/nginx/conf.d/default.conf`):

```nginx
server {
    listen 80;
    server_name 10.6.34.95;

    # Serve static Next.js app at /radchat
    location /radchat/ {
        alias /var/www/radchat/;

        # Try to serve file directly, then directory, then .html, or 404
        try_files $uri $uri/ $uri.html =404;

        # Serve index.html by default
        index index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Proxy Ollama API requests to the Ollama server
    location /radchat/api/ollama/ {
        # Proxy to Ollama server at 10.6.135.213:80
        proxy_pass http://10.6.135.213:80/;

        # HTTP version 1.1 required for streaming
        proxy_http_version 1.1;

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Critical for streaming responses (don't buffer)
        proxy_buffering off;
        proxy_cache off;

        # Timeouts for long-running LLM requests
        proxy_read_timeout 300s;        # 5 minutes
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;

        # WebSocket support (if needed in future)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 3. Verify Nginx Configuration

Test the nginx configuration for syntax errors:

```bash
sudo nginx -t
```

If successful, you should see:
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 4. Reload Nginx

Apply the new configuration:

```bash
sudo systemctl reload nginx
# or
sudo nginx -s reload
```

### 5. Set Correct Permissions

Ensure nginx can read the files:

```bash
sudo chown -R www-data:www-data /var/www/radchat
sudo chmod -R 755 /var/www/radchat
```

(Adjust `www-data` if your nginx runs under a different user)

## Testing

### Test Static File Serving

1. Open browser and navigate to: `http://10.6.34.95/radchat`
2. You should see the chat application load
3. Check browser console (F12) for any errors

### Test Ollama Proxy

1. Select a model from the dropdown (should fetch from Ollama)
2. Send a test message
3. Verify streaming response works

## Troubleshooting

### Issue: 404 Not Found

**Cause:** Static files not in correct location
**Fix:** Verify files are in `/var/www/radchat/` with `index.html` at root

```bash
ls -la /var/www/radchat/
# Should show index.html, _next/, fonts/, etc.
```

### Issue: Assets (JS/CSS) not loading (404)

**Cause:** Incorrect nginx alias or trailing slash
**Fix:** Ensure `location /radchat/` has trailing slash and `alias` ends with `/`

### Issue: Ollama API connection fails

**Symptoms:**
- Model dropdown empty
- "Failed to fetch models" error
- Messages don't send

**Debugging:**

1. **Test nginx proxy:**
   ```bash
   curl -v http://10.6.34.95/radchat/api/ollama/api/tags
   ```
   Should return list of models in JSON

2. **Test direct Ollama connection:**
   ```bash
   curl http://10.6.135.213:80/api/tags
   ```
   Should return same list

3. **Check nginx error logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

**Common causes:**
- Ollama server not running at `10.6.135.213:80`
- Network firewall blocking connection
- Incorrect proxy_pass URL (ensure trailing `/`)

### Issue: Streaming responses cut off

**Cause:** Nginx buffering enabled
**Fix:** Verify these settings in nginx config:
```nginx
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 300s;
```

### Issue: Long responses timeout

**Cause:** Default timeout too short
**Fix:** Increase `proxy_read_timeout` in nginx config (currently 300s = 5 minutes)

### Issue: Incorrect API URL in browser (e.g., `http://api:11434/...`)

**Symptoms:**
- Chrome DevTools shows malformed URLs like `http://api:11434/ollama/api/tags`
- Model dropdown fails to load
- Network errors in browser console

**Cause:** The production build was configured with a relative path `/api/ollama` instead of the absolute URL with basePath.

**Fix:** Verify `.env.production` uses the **absolute URL**:

```bash
# ✅ CORRECT
NEXT_PUBLIC_OLLAMA_BASE_URL=http://10.6.34.95/radchat/api/ollama

# ❌ WRONG - Missing basePath and host
NEXT_PUBLIC_OLLAMA_BASE_URL=/api/ollama
```

**Why this matters:**
1. The `ollama/browser` library requires a complete URL for proper parsing
2. The URL must include the basePath (`/radchat`) for correct routing
3. Using an absolute URL ensures same-origin requests (no CORS issues)

**Verification:**
After rebuilding with the correct URL, check the browser's network tab:
- API calls should go to: `http://10.6.34.95/radchat/api/ollama/api/tags`
- NOT to: `http://api:11434/...` or `/api/ollama/api/tags`

## Security Notes

1. **No external internet required** - App works entirely on hospital intranet
2. **No data sent externally** - All processing happens on local Ollama server
3. **Static files only** - No server-side execution, just HTML/CSS/JS
4. **CORS avoided** - Proxy ensures same-origin requests

## Updating the Application

To update to a new version:

1. Extract new build artifact to temporary location
2. Stop nginx: `sudo systemctl stop nginx`
3. Backup old version: `sudo mv /var/www/radchat /var/www/radchat.backup`
4. Copy new version: `sudo cp -r /tmp/new-build /var/www/radchat`
5. Fix permissions: `sudo chown -R www-data:www-data /var/www/radchat`
6. Start nginx: `sudo systemctl start nginx`
7. Test application
8. Remove backup: `sudo rm -rf /var/www/radchat.backup`

## Configuration Files Location

- **Nginx main config:** `/etc/nginx/nginx.conf`
- **Site config:** `/etc/nginx/sites-available/default` or `/etc/nginx/conf.d/default.conf`
- **Access logs:** `/var/log/nginx/access.log`
- **Error logs:** `/var/log/nginx/error.log`

## Contact

For issues with:
- **Application bugs:** Contact development team
- **Ollama server:** Contact AI infrastructure team
- **Nginx/network:** Contact hospital IT team
