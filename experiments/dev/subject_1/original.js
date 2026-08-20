// Subject: Telemetry Poller & Webhook Dispatcher
// Legacy Problem: Spaghetti setInterval inside global scope, mutable global state, tightly coupled file writes

const fs = require('fs');
const http = require('http');

let pollingInterval = null;
let cachedTelemetryData = [];
let isRunning = false;
let failureCount = 0;

function startPolling(targetUrl, frequencyMs) {
  if (isRunning) {
    console.log("Already running!");
    return;
  }
  isRunning = true;
  console.log("Starting polling for " + targetUrl);

  pollingInterval = setInterval(() => {
    http.get(targetUrl, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          parsed.timestamp = Date.now();
          cachedTelemetryData.push(parsed);

          // Append directly to disk synchronously every tick
          fs.writeFileSync('./telemetry.log', JSON.stringify(parsed) + '\n', { flag: 'a' });

          // Trigger webhook if CPU is > 90
          if (parsed.cpu && parsed.cpu > 90) {
            http.get('http://alert-server/notify?msg=HighCPU', (alertRes) => {
              console.log("Alert sent");
            });
          }
        } catch (e) {
          failureCount++;
          console.error("Failed to parse JSON: " + e.message);
        }
      });
    }).on('error', (err) => {
      failureCount++;
      console.error("Network error: " + err.message);
      if (failureCount > 5) {
        clearInterval(pollingInterval);
        isRunning = false;
        console.log("Stopped polling due to excessive errors.");
      }
    });
  }, frequencyMs);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    isRunning = false;
    console.log("Polling stopped.");
  }
}

module.exports = { startPolling, stopPolling, getCachedData: () => cachedTelemetryData };
