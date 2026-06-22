// Configuration for Electron app
module.exports = {
  // Server connection settings
  server: {
    // Change this to connect to a remote server
    // Examples:
    //   'http://localhost:6029'        - Local server (starts bundled server)
    //   'http://192.168.1.100:6029'    - LAN server (connects only, no local server)
    //   'http://server.example.com:6029' - Remote server (connects only)
    host: process.env.SERVER_HOST || 'http://localhost:6029',

    // Set to false to skip starting the bundled server (for remote connections)
    // Set to true to start the bundled server (for local/all-in-one mode)
    // If null/undefined, auto-detects based on host (localhost = start server)
    startBundledServer: true,

    // How long to wait for server to start (in milliseconds)
    startupDelay: 3000
  },

  // Window settings
  window: {
    width: 1400,
    height: 1024,
    title: 'Attendance Management'
  }
};
