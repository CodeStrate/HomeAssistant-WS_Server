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
        const { message } = JSON.parse(body);
        if (!message) throw new Error("Missing message field");

        // Broadcast to all WS clients
        wss.clients.forEach((c) => {
          if (c.readyState === WebSocket.OPEN) {
            c.send(JSON.stringify({ type: "broadcast", message }));
          }
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", broadcast: message }));
        logger.info(`[HTTP] Broadcasted → ${message}`);
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: (err as Error).message }));
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

wss.on("connection", (ws: WebSocket, req) => {
  const token = new URL(req.url || "", `http://${req.headers.host}`).searchParams.get("token");
  if(token != process.env.HA_TOKEN){
    logger.error("[WS] Unauthorized Client, Please check your Auth Token");
    ws.close();
  }else{
    logger.info("[WS] Authorized client connected");
  }

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