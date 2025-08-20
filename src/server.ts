// wsServer.ts
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import dotenv from "dotenv";
import logger from "./logger";

dotenv.config();

const PORT = Number(process.env.WS_PORT) || 3001;

/* ──────────────────────────────────────────────────────────
   1. Plain HTTP server with a /broadcast endpoint
   ───────────────────────────────────────────────────────── */
const httpServer = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/broadcast") {
    let body = "";

    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
    try {
    const payload = JSON.parse(body);
    
    // Use the message field if it exists, otherwise use the whole payload
    const message = payload.message || payload;
    if (!message) throw new Error("Missing message field");

    // Broadcast to all WS clients - use the original payload format from HA
    wss.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN) {
        c.send(JSON.stringify({
          sender: payload.sender || "HomeAssistant",
          message: message,
          timestamp: payload.timestamp || new Date().toISOString(),
          type: payload.type || "message"
        }));
      }
    });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", broadcast: message }));
        logger.info(`[HTTP] Broadcasted → ${message}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error(`[HTTP] JSON parse error: ${errorMessage}, body: ${body}`);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: errorMessage }));
      }
    });
    return;
  }

  // Fallback 404
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

/* ──────────────────────────────────────────────────────────
   2. WebSocket Server piggy-backs on the same HTTP server
   ───────────────────────────────────────────────────────── */
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws: WebSocket) => {
 
    logger.info("[WS] Client connected");

  ws.on("message", (msg) => {
    // Optional: echo or log incoming client messages
    logger.debug(`[WS] incoming → ${msg}`);
  });

  ws.on("close", () => logger.info("[WS] client disconnected"));
});

/* ──────────────────────────────────────────────────────────
   3. Start listening, then spin up ngrok
   ───────────────────────────────────────────────────────── */
httpServer.listen(PORT, "0.0.0.0", async () =>{
  logger.info(`[WS] listening on ws://0.0.0.0:${PORT}`);
  logger.info(`[POST] BROADCAST API on https://0.0.0.0:${PORT}/api/broadcast`)
});