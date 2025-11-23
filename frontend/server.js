const express = require("express");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

// Enable CORS
app.use(cors());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

// Try HTTPS first (port 3443), fallback to HTTP (port 3000)
const HTTPS_PORT = 3443;
const HTTP_PORT = 3000;

// Check if SSL certificates exist
const certPath = path.join(__dirname, "cert.pem");
const keyPath = path.join(__dirname, "key.pem");

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  // Start HTTPS server
  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
    console.log("✅ HTTPS Server running on https://localhost:" + HTTPS_PORT);
    console.log("✅ Signed decrypt (userDecrypt) will work!");
    console.log("\n⚠️  You may need to accept the self-signed certificate in your browser\n");
  });
} else {
  console.log("⚠️  SSL certificates not found. Generating self-signed certificates...\n");
  console.log("Run these commands to generate certificates:");
  console.log("  cd frontend");
  console.log(
    '  openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"\n',
  );
  console.log("Then restart this server.\n");
  console.log("Starting HTTP fallback server...\n");

  // Fallback to HTTP
  http.createServer(app).listen(HTTP_PORT, () => {
    console.log("⚠️  HTTP Server running on http://localhost:" + HTTP_PORT);
    console.log("⚠️  Signed decrypt (userDecrypt) will NOT work (requires HTTPS)");
    console.log("✅ Public decrypt will work if owner publishes results\n");
  });
}
