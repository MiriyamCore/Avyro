#!/bin/sh
# Generate /etc/nginx/conf.d/default.conf at container start.
# HTTP always. TLS is enabled automatically when a Let's Encrypt cert exists for NGINX_HOST.
set -e

host="${NGINX_HOST:-_}"
cert="/etc/letsencrypt/live/${host}/fullchain.pem"
key="/etc/letsencrypt/live/${host}/privkey.pem"
ssl=0
if [ "$host" != "_" ] && [ -n "$host" ] && [ -f "$cert" ] && [ -f "$key" ]; then
  ssl=1
fi

proxy_location='
        proxy_pass http://web:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
'

{
  cat <<'EOF'
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

EOF

  if [ "$ssl" -eq 1 ]; then
    cat <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${host};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ${host};

    ssl_certificate     ${cert};
    ssl_certificate_key ${key};
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_session_timeout 1d;
    ssl_session_cache   shared:SSL:10m;

    client_max_body_size 32m;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
${proxy_location}
    }
}
EOF
  else
    cat <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 32m;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
${proxy_location}
    }
}
EOF
  fi
} > /etc/nginx/conf.d/default.conf
