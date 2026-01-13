/**
 * Origin Brain Trainer MCP Server (Express + SSE + JSON-RPC /message)
 *
 * Fixes ChatGPT "timeout" during connector creation by implementing:
 *  - GET /sse  (server -> client event stream)
 *  - POST /message (client -> server JSON-RPC for initialize/tools/list/tools/call)
 *
 * Keeps your existing REST endpoints:
 *  - POST /upload
 *  - GET /files
 *  - DELETE /files/:filename
 *  - POST /mcp/initialize
 *  - POST /mcp/tools/list
 *  - POST /mcp/tools/call
 */

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.set("trust proxy", 1); // important behind Railway proxy

const PORT = process.env.PORT || 3000;

// Enable CORS + JSON
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Create uploads directory
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Store for SSE clients with heartbeat
const sseClients = new Map();

// MCP Server Info
const MCP_SERVER_INFO = {
  name: "origin-brain-trainer",
  version: "1.0.0",
  description: "MCP server for Origin Brain Trainer file uploads",
  capabilities: {
    tools: true,
    resources: false,
    prompts: false,
  },
};

// Available tools
const TOOLS = [
  {
    name: "upload_file",
    description: "Upload files to the Origin Brain Trainer server with optional processing instructions",
    inputSchema: {
      type: "object",
      properties: {
        instructions: {
          type: "string",
          description: "Processing instructions for the uploaded files",
        },
      },
      required: [],
    },
  },
  {
    name: "list_files",
    description: "List all uploaded files",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "delete_file",
    description: "Delete a specific uploaded file",
    inputSchema: {
      type: "object",
      properties: {
        filename: { type: "string", description: "Name of the file to delete" },
      },
      required: ["filename"],
    },
  },
];

/** -------------------------
 * Helpers
 * ------------------------*/
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function sendSSE(res, event, data) {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (error) {
    console.error("❌ Error sending SSE:", error);
  }
}

function broadcastSSE(event, data) {
  console.log(`📢 Broadcasting SSE event: ${event} to ${sseClients.size} clients`);
  sseClients.forEach((client, clientId) => {
    try {
      sendSSE(client.res, event, data);
    } catch (error) {
      console.error(`❌ Failed to send to client ${clientId}:`, error);
      clearInterval(client.heartbeat);
      sseClients.delete(clientId);
    }
  });
}

async function listFiles() {
  const files = fs.readdirSync(uploadsDir);
  const fileDetails = files.map((filename) => {
    const filepath = path.join(uploadsDir, filename);
    const stats = fs.statSync(filepath);
    return {
      name: filename,
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      created: stats.birthtime,
      modified: stats.mtime,
    };
  });

  return {
    success: true,
    count: fileDetails.length,
    files: fileDetails,
    timestamp: new Date().toISOString(),
  };
}

async function deleteFile(filename) {
  if (!filename) throw new Error("filename is required");

  const filepath = path.join(uploadsDir, filename);

  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);

    // Broadcast deletion to SSE clients
    broadcastSSE("file_deleted", {
      filename,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: `File ${filename} deleted successfully`,
      timestamp: new Date().toISOString(),
    };
  }

  throw new Error("File not found");
}

/**
 * Executes a tool and returns a "result object" (your internal tool result),
 * then the MCP wrapper will turn it into MCP response content.
 */
async function executeTool(name, args) {
  switch (name) {
    case "list_files":
      return await listFiles();

    case "delete_file":
      return await deleteFile(args?.filename);

    case "upload_file":
      return {
        success: true,
        message: "File upload endpoint ready. Use POST /upload with multipart/form-data to upload files.",
        instructions: args?.instructions || "No instructions provided",
        uploadEndpoint: "/upload",
      };

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/** -------------------------
 * SSE endpoint (server -> client)
 * ------------------------*/
app.get("/sse", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Accel-Buffering": "no",
  });

  const clientId = Date.now(); // simple unique-ish id

  // Prefer explicit public base URL (Railway proxy can cause protocol issues)
  const baseUrl =
    process.env.PUBLIC_BASE_URL ||
    `${req.protocol}://${req.get("host")}`;

  // IMPORTANT: tell clients (ChatGPT) where to POST JSON-RPC requests
  const postUrl = `${baseUrl}/message?clientId=${encodeURIComponent(clientId)}`;

  // Initial connection message
  sendSSE(res, "connected", {
    message: "Connected to Origin Brain Trainer MCP Server",
    server: MCP_SERVER_INFO,
    clientId,
    postUrl,
  });

  // Heartbeat every 15 seconds
  const heartbeat = setInterval(() => {
    sendSSE(res, "heartbeat", {
      timestamp: new Date().toISOString(),
      status: "alive",
    });
  }, 15000);

  sseClients.set(clientId, { res, heartbeat });
  console.log(`✅ SSE Client ${clientId} connected. Total clients: ${sseClients.size}`);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(clientId);
    console.log(`❌ SSE Client ${clientId} disconnected. Total clients: ${sseClients.size}`);
  });
});

/** -------------------------
 * MCP JSON-RPC message endpoint (client -> server)
 * This is what ChatGPT expects.
 * ------------------------*/
app.post("/message", async (req, res) => {
  const clientId = req.query.clientId ? Number(req.query.clientId) : null;
  const rpc = req.body;

  // Validate JSON-RPC-ish request
  if (!rpc || rpc.jsonrpc !== "2.0" || !rpc.method) {
    return res.status(400).json({
      jsonrpc: "2.0",
      id: rpc?.id ?? null,
      error: { code: -32600, message: "Invalid Request" },
    });
  }

  try {
    // 1) initialize
    if (rpc.method === "initialize") {
      return res.json({
        jsonrpc: "2.0",
        id: rpc.id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: MCP_SERVER_INFO,
          // MCP generally uses capability objects keyed by feature
          capabilities: { tools: {} },
        },
      });
    }

    // 2) tools/list
    if (rpc.method === "tools/list") {
      return res.json({
        jsonrpc: "2.0",
        id: rpc.id,
        result: { tools: TOOLS },
      });
    }

    // 3) tools/call
    if (rpc.method === "tools/call") {
      const { name, arguments: args } = rpc.params || {};
      if (!name) {
        return res.json({
          jsonrpc: "2.0",
          id: rpc.id,
          error: { code: -32602, message: "Missing tool name" },
        });
      }

      const resultObj = await executeTool(name, args);

      // Optional: emit an SSE event back to that client
      if (clientId && sseClients.has(clientId)) {
        sendSSE(sseClients.get(clientId).res, "tool_result", {
          tool: name,
          result: resultObj,
          timestamp: new Date().toISOString(),
        });
      }

      return res.json({
        jsonrpc: "2.0",
        id: rpc.id,
        result: {
          content: [{ type: "text", text: JSON.stringify(resultObj, null, 2) }],
        },
      });
    }

    // Unknown method
    return res.json({
      jsonrpc: "2.0",
      id: rpc.id ?? null,
      error: { code: -32601, message: `Method not found: ${rpc.method}` },
    });
  } catch (err) {
    console.error("❌ /message error:", err);
    return res.status(500).json({
      jsonrpc: "2.0",
      id: rpc.id ?? null,
      error: { code: -32000, message: err.message || "Server error" },
    });
  }
});

/** -------------------------
 * Your existing "REST MCP" endpoints (optional)
 * Leaving these in place for backwards compatibility.
 * ------------------------*/
app.post("/mcp/initialize", (req, res) => {
  console.log("📡 MCP Initialize request received");
  res.json({
    protocolVersion: "2024-11-05",
    serverInfo: MCP_SERVER_INFO,
    capabilities: MCP_SERVER_INFO.capabilities,
  });
});

app.post("/mcp/tools/list", (req, res) => {
  console.log("🔧 MCP Tools list request received");
  res.json({ tools: TOOLS });
});

app.post("/mcp/tools/call", async (req, res) => {
  const { name, arguments: args } = req.body;
  console.log(`⚡ MCP Tool called: ${name}`, args);

  try {
    const resultObj = await executeTool(name, args);
    res.json({
      content: [{ type: "text", text: JSON.stringify(resultObj, null, 2) }],
    });
  } catch (error) {
    console.error("❌ Tool execution error:", error);
    res.status(500).json({
      error: { code: "TOOL_ERROR", message: error.message },
    });
  }
});

/** -------------------------
 * Regular file upload endpoint (web interface / tool usage)
 * ------------------------*/
app.post("/upload", upload.any(), (req, res) => {
  try {
    const files = req.files || [];
    const instructions = req.body.instructions;
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};

    console.log("\n📦 New Upload Received:");
    console.log("Files:", files.length);
    console.log("Instructions:", instructions);

    const processedFiles = files.map((file) => ({
      originalName: file.originalname,
      savedAs: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      path: file.path,
    }));

    processedFiles.forEach((file) => {
      console.log(`  ✓ ${file.originalName} (${(file.size / 1024).toFixed(2)} KB)`);
    });

    // Broadcast to SSE clients
    broadcastSSE("upload", {
      fileCount: files.length,
      files: processedFiles,
      instructions,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Successfully uploaded ${files.length} file(s)`,
      fileCount: files.length,
      files: processedFiles,
      instructions,
      metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/** -------------------------
 * Health + info endpoints
 * ------------------------*/
app.get("/", (req, res) => {
  res.json({
    status: "MCP Server Running",
    message: "Origin Brain Trainer MCP Server",
    version: "1.0.0",
    protocol: "MCP with SSE + JSON-RPC /message",
    activeConnections: sseClients.size,
    endpoints: {
      sse: "/sse",
      message: "/message",
      initialize: "/mcp/initialize",
      tools_list: "/mcp/tools/list",
      tools_call: "/mcp/tools/call",
      upload: "/upload",
      files: "/files",
      health: "/health",
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

/** -------------------------
 * File list + delete endpoints
 * ------------------------*/
app.get("/files", async (req, res) => {
  try {
    const result = await listFiles();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/files/:filename", async (req, res) => {
  try {
    const result = await deleteFile(req.params.filename);
    res.json(result);
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

/** -------------------------
 * Error handling + graceful shutdown
 * ------------------------*/
app.use((error, req, res, next) => {
  console.error("❌ Server error:", error);
  res.status(500).json({ success: false, error: "Internal server error" });
});

process.on("SIGTERM", () => {
  console.log("⚠️ SIGTERM received, closing server...");
  sseClients.forEach((client) => {
    clearInterval(client.heartbeat);
    client.res.end();
  });
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🚀 MCP Server Running                   ║
║   Port: ${PORT}                              ║
║   Protocol: MCP with SSE + /message       ║
║   SSE endpoint: /sse                      ║
║   Message endpoint: /message              ║
║   Upload endpoint: /upload                ║
╚═══════════════════════════════════════════╝
  `);
});
