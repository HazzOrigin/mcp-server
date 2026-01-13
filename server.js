// server.js
//
// Origin Brain Trainer MCP Server (Express)
// - Single MCP endpoint /mcp that supports BOTH:
//     GET  /mcp  -> SSE stream (server -> client)
//     POST /mcp  -> JSON-RPC (client -> server): initialize, tools/list, tools/call
// - Backwards-compatible aliases:
//     GET  /sse      -> same as GET /mcp
//     POST /message  -> same as POST /mcp
// - File upload + file management endpoints remain the same.
//
// IMPORTANT for ChatGPT "New App" UI:
//   Use MCP Server URL = https://mcp-server-production-067c.up.railway.app/mcp
//
// Railway:
//   Set env var PUBLIC_BASE_URL=https://mcp-server-production-067c.up.railway.app
//   (prevents http/https mismatch behind proxy)

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Uploads directory
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// SSE clients
const sseClients = new Map();

// MCP info
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

// Tools
const TOOLS = [
  {
    name: "upload_file",
    description: "Upload files to the Origin Brain Trainer server with optional processing instructions",
    inputSchema: {
      type: "object",
      additionalProperties: false,
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
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
  },
  {
    name: "delete_file",
    description: "Delete a specific uploaded file",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        filename: {
          type: "string",
          description: "Name of the file to delete",
        },
      },
      required: ["filename"],
    },
  },
];

// --------------------
// Helpers
// --------------------
function nowIso() {
  return new Date().toISOString();
}

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
  } catch (err) {
    console.error("❌ Error sending SSE:", err);
  }
}

function broadcastSSE(event, data) {
  console.log(`📢 Broadcasting SSE event: ${event} to ${sseClients.size} clients`);
  sseClients.forEach((client, clientId) => {
    try {
      sendSSE(client.res, event, data);
    } catch (err) {
      console.error(`❌ Failed to send to client ${clientId}:`, err);
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
    timestamp: nowIso(),
  };
}

async function deleteFile(filename) {
  if (!filename) throw new Error("filename is required");

  const filepath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filepath)) {
    throw new Error("File not found");
  }

  fs.unlinkSync(filepath);

  broadcastSSE("file_deleted", {
    filename,
    timestamp: nowIso(),
  });

  return {
    success: true,
    message: `File ${filename} deleted successfully`,
    timestamp: nowIso(),
  };
}

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

// Build base URL safely (Railway proxy)
function getBaseUrl(req) {
  // Strongly recommended: set PUBLIC_BASE_URL in Railway to the HTTPS public URL
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;

  // Fallback: infer from request (can be http behind proxy if trust proxy not set correctly)
  return `${req.protocol}://${req.get("host")}`;
}

// --------------------
// MCP single endpoint: GET /mcp (SSE)
// --------------------
function handleMcpSse(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Accel-Buffering": "no",
  });

  const clientId = Date.now();
  const baseUrl = getBaseUrl(req);

  // IMPORTANT: For "single endpoint" transport, postUrl should point back to /mcp
  const postUrl = `${baseUrl}/mcp?clientId=${encodeURIComponent(clientId)}`;

  sendSSE(res, "connected", {
    message: "Connected to Origin Brain Trainer MCP Server",
    server: MCP_SERVER_INFO,
    clientId,
    postUrl,
  });

  // Heartbeat (8s to keep edges happy)
  const heartbeat = setInterval(() => {
    sendSSE(res, "heartbeat", { timestamp: nowIso(), status: "alive" });
  }, 8000);

  sseClients.set(clientId, { res, heartbeat });
  console.log(`✅ SSE Client ${clientId} connected. Total clients: ${sseClients.size}`);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(clientId);
    console.log(`❌ SSE Client ${clientId} disconnected. Total clients: ${sseClients.size}`);
  });
}

// --------------------
// MCP single endpoint: POST /mcp (JSON-RPC)
// --------------------
async function handleMcpMessage(req, res) {
  const clientId = req.query.clientId ? Number(req.query.clientId) : null;
  const rpc = req.body;

  // Log what ChatGPT is doing (helpful during setup)
  try {
    console.log("📨 MCP RPC:", rpc?.method, "id:", rpc?.id, "clientId:", clientId || "n/a");
  } catch (_) {}

  // Validate JSON-RPC-ish request
  if (!rpc || rpc.jsonrpc !== "2.0" || !rpc.method) {
    return res.status(400).json({
      jsonrpc: "2.0",
      id: rpc?.id ?? null,
      error: { code: -32600, message: "Invalid Request" },
    });
  }

  try {
    // initialize
    if (rpc.method === "initialize") {
      return res.json({
        jsonrpc: "2.0",
        id: rpc.id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: MCP_SERVER_INFO,
          // MCP usually expects capability objects keyed by feature
          capabilities: { tools: {} },
        },
      });
    }

    // tools/list
    if (rpc.method === "tools/list") {
      return res.json({
        jsonrpc: "2.0",
        id: rpc.id,
        result: { tools: TOOLS },
      });
    }

    // tools/call
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

      // Optional: stream an SSE event back to this client
      if (clientId && sseClients.has(clientId)) {
        sendSSE(sseClients.get(clientId).res, "tool_result", {
          tool: name,
          result: resultObj,
          timestamp: nowIso(),
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
    console.error("❌ MCP error:", err);
    return res.status(500).json({
      jsonrpc: "2.0",
      id: rpc.id ?? null,
      error: { code: -32000, message: err.message || "Server error" },
    });
  }
}

// Primary MCP endpoint
app.get("/mcp", handleMcpSse);
app.post("/mcp", handleMcpMessage);

// Backwards compatible aliases
app.get("/sse", handleMcpSse);
app.post("/message", handleMcpMessage);

// Optional: nicer response if user opens /message in browser
app.get("/message", (req, res) => {
  res.status(200).json({
    ok: true,
    note: "Use POST for JSON-RPC. For streaming, use GET /mcp or /sse.",
    mcp: "/mcp",
    sse: "/sse",
  });
});

// --------------------
// Your existing REST endpoints
// --------------------

// Regular file upload endpoint (for web interface)
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
      timestamp: nowIso(),
    });

    res.json({
      success: true,
      message: `Successfully uploaded ${files.length} file(s)`,
      fileCount: files.length,
      files: processedFiles,
      instructions,
      metadata,
      timestamp: nowIso(),
    });
  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// List files endpoint
app.get("/files", async (req, res) => {
  try {
    const result = await listFiles();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete file endpoint
app.delete("/files/:filename", async (req, res) => {
  try {
    const result = await deleteFile(req.params.filename);
    res.json(result);
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Root info
app.get("/", (req, res) => {
  res.json({
    status: "MCP Server Running",
    message: "Origin Brain Trainer MCP Server",
    version: MCP_SERVER_INFO.version,
    protocol: "MCP via single endpoint /mcp (GET SSE + POST JSON-RPC)",
    activeConnections: sseClients.size,
    recommended_mcp_server_url_for_chatgpt: `${getBaseUrl(req)}/mcp`,
    endpoints: {
      mcp: "/mcp",
      sse_alias: "/sse",
      message_alias: "/message",
      upload: "/upload",
      files: "/files",
      health: "/health",
    },
    uptime: process.uptime(),
    timestamp: nowIso(),
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error("❌ Server error:", error);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// Graceful shutdown
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
║   MCP (single endpoint): /mcp             ║
║   SSE alias: /sse                         ║
║   Message alias: /message                 ║
║   Upload endpoint: /upload                ║
╚═══════════════════════════════════════════╝
  `);
});
