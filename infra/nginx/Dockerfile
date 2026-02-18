# Custom nginx image with baked-in config
FROM nginx:alpine

# Install envsubst for variable substitution
RUN apk add --no-cache gettext

# Copy the config template
COPY default.conf.template /etc/nginx/conf.d/default.conf.template

# Copy the entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Use custom entrypoint to substitute env vars and start nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
