// Dev-only: a tiny webhook receiver that logs POST bodies.
// Run: node tools/webhook-receiver.js   (listens on http://localhost:8123)
import { createServer } from "node:http";

const server = createServer((req, res) => {
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
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  });
});

server.listen(8123, () => console.log("test-receiver listening on http://localhost:8123"));
