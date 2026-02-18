#!/bin/sh
set -e

# Substitute environment variables in the nginx config template
envsubst '$DOMAIN' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Execute the provided command (nginx)
exec "$@"
