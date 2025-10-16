# Server Config

## Ollama Config

```bash
sudo snap set ollama origins="*"
```

## Nginx Config

Location: `/etc/nginx/nginx.conf`

```conf
# Proxy Ollama API requests to the Ollama server
    location /radchat/api/ollama/api/chat {

        # Proxy to Ollama server at 10.6.135.213:80
        proxy_pass http://10.6.135.213/api/chat;

        # Essential for streaming responses
        proxy_buffering off;
        proxy_cache off;

        # Headers for proper proxying
        proxy_set_header Host 10.6.135.213;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Support for chunked transfer encoding (streaming)
        chunked_transfer_encoding on;
        proxy_http_version 1.1;
        proxy_set_header Connection "";

        # Timeouts for long-running requests
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /radchat/api/ollama/api/tags {
        proxy_pass http://10.6.135.213/api/tags;

        # Add the same headers here too
        proxy_set_header Host 10.6.135.213;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Serve static Next.js app at /radchat
    location /radchat {
        alias /home/ubuntu/radchat;

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
```