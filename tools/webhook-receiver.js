// Dev-only: a tiny webhook receiver that logs POST bodies.
// Run: node tools/webhook-receiver.js   (listens on http://localhost:8123)
//
// It answers the CORS preflight (OPTIONS) with permissive headers so it can be
// used to test the extension's fetch even when the request is in CORS mode
// (i.e. the browser did NOT bypass CORS via the host permission). A real
// Home Assistant either bypasses CORS via the granted host permission (no
// preflight at all) or must be configured to allow the origin.
import { createServer } from "node:http";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    console.log(
      new Date().toISOString(),
      "OPTIONS preflight",
      req.url,
      "-> 204",
    );
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    console.log(
      new Date().toISOString(),
      req.method,
      req.url,
      "headers=",
      JSON.stringify(req.headers),
      "body=",
      body,
    );
    res.writeHead(200, { "Content-Type": "text/plain", ...CORS_HEADERS });
    res.end("ok");
  });
});

server.listen(8123, () =>
  console.log("webhook-receiver listening on http://localhost:8123"),
);
