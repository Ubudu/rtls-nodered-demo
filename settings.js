/**
 * Node-RED settings for the Ubudu RTLS integration demo.
 *
 * This is a deliberately minimal, demo-friendly configuration:
 *   - the editor and dashboard are served on port 1880
 *   - the flow reads its configuration (API key, namespace, etc.) from
 *     environment variables, so no secrets live in the image or the flow
 *   - the editor is left open (no login) to keep the partner demo simple.
 *     For anything beyond a local demo, set `adminAuth` below.
 */

module.exports = {
  // ---- Runtime / flow ------------------------------------------------------
  flowFile: 'flows.json',
  flowFilePretty: true,

  // Node-RED listens on 0.0.0.0:1880 inside the container.
  uiPort: process.env.PORT || 1880,

  // ---- Editor & dashboard --------------------------------------------------
  // Editor:    http://localhost:1880/
  // Dashboard: http://localhost:1880/ui
  httpAdminRoot: '/',
  httpNodeRoot: '/', // exposes the flow's HTTP endpoints, e.g. GET /tags
  ui: { path: 'ui' },

  // ---- Logging -------------------------------------------------------------
  logging: {
    console: {
      level: process.env.NODE_RED_LOG_LEVEL || 'info',
      metrics: false,
      audit: false,
    },
  },

  // ---- Function node context ----------------------------------------------
  // Allow function/inject nodes to read environment variables via env.get().
  functionGlobalContext: {},
  functionExternalModules: true,

  // ---- Misc ----------------------------------------------------------------
  exportGlobalContextKeys: false,

  editorTheme: {
    projects: { enabled: false },
    page: { title: 'Ubudu RTLS Integration Demo' },
    header: { title: 'Ubudu RTLS Integration Demo' },
    tours: false,
  },

  // ---- Optional: protect the editor ---------------------------------------
  // Uncomment and set credentials (or generate a hash with
  //   `npx node-red admin hash-pw`) to require a login for the editor.
  //
  // adminAuth: {
  //   type: 'credentials',
  //   users: [{
  //     username: process.env.NODE_RED_USER || 'admin',
  //     password: process.env.NODE_RED_PASSWORD_HASH, // bcrypt hash
  //     permissions: '*',
  //   }],
  // },
};
