#!/bin/sh
export BACKEND_HOST=$(echo "$BACKEND_URL" | sed 's|https\?://||' | sed 's|/.*||')
envsubst '${BACKEND_URL} ${BACKEND_HOST}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Generate runtime config for browser-side variables
cat <<EOF > /usr/share/nginx/html/config.js
window.__CONFIG__ = {
  VITE_LIVEKIT_URL: "${VITE_LIVEKIT_URL:-}"
};
EOF

exec nginx -g 'daemon off;'
