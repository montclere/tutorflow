FROM caddy:2.11.8-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY frontend/dist /srv
