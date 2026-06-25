# Ubudu RTLS integration demo — Node-RED preloaded with a tag→zone flow.
#
# Build:  docker build -t ubudu-rtls-nodered-demo .
# Run:    docker run -p 1880:1880 \
#           -e RTLS_NAMESPACE=<your-namespace> \
#           -e RTLS_API_KEY=<your-api-key> \
#           ubudu-rtls-nodered-demo
#
# Or just use docker-compose (see docker-compose.yml).

FROM nodered/node-red:4.0

# Install the dashboard nodes used by the demo flow.
# (Run as the image's default `node-red` user, into the /data directory that
#  Node-RED loads custom nodes from.)
#   - node-red-dashboard       : the dashboard runtime + /ui page
#   - node-red-node-ui-table   : the ui_table node used by the demo table
WORKDIR /data
RUN npm install --no-audit --no-fund \
      node-red-dashboard@3.6.5 \
      node-red-node-ui-table@0.4.3

# Preload the demo flow and settings into /data.
COPY --chown=node-red:node-red settings.js /data/settings.js
COPY --chown=node-red:node-red flows.json  /data/flows.json

# Restore the base image's working directory so its ./entrypoint.sh resolves.
WORKDIR /usr/src/node-red

# Node-RED editor + dashboard + HTTP endpoints.
EXPOSE 1880

# Sensible defaults; override at runtime. RTLS_NAMESPACE and RTLS_API_KEY have
# no default on purpose — the flow refuses to poll until they are provided.
ENV RTLS_BASE_URL=https://rtls.ubudu.com/api \
    POLL_INTERVAL_SEC=5 \
    MQTT_ENABLE=false \
    MQTT_TOPIC=ubudu/rtls/zones \
    MQTT_HOST=mqtt \
    MQTT_PORT=1883

# Healthcheck: the editor responding means Node-RED is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:1880/', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

# The base image's entrypoint launches Node-RED with --userDir /data.
