const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }
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
    prompts: false
  }
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
          description: "Processing instructions for the uploaded files"
        }
      }
    }
  },
  {
    name: "list_files",
    description: "List all uploaded files",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "delete_file",
    description: "Delete a specific uploaded file",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "Name of the file to delete"
        }
      },
      required: ["filename"]
    }
  }
];

// SSE endpoint with heartbeat
app.get('/sse', (req, res) => {
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no' // Disable buffering in nginx
  });

  const clientId = Date.now();
  
  // Send initial connection message
  sendSSE(res, 'connected', { 
    message: 'Connected to Origin Brain Trainer MCP Server',
    server: MCP_SERVER_INFO,
    clientId: clientId
  });

  // Set up heartbeat every 15 seconds
  const heartbeat = setInterval(() => {
    sendSSE(res, 'heartbeat', { 
      timestamp: new Date().toISOString(),
      status: 'alive'
    });
  }, 15000);

  // Store client with heartbeat
  sseClients.set(clientId, { res, heartbeat });

  console.log(`✅ SSE Client ${clientId} connected. Total clients: ${sseClients.size}`);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(clientId);
    console.log(`❌ SSE Client ${clientId} disconnected. Total clients: ${sseClients.size}`);
  });
});

// MCP Initialize endpoint
app.post('/mcp/initialize', (req, res) => {
  console.log('📡 MCP Initialize request received');
  res.json({
    protocolVersion: "2024-11-05",
    serverInfo: MCP_SERVER_INFO,
    capabilities: MCP_SERVER_INFO.capabilities
  });
});

// MCP List Tools endpoint
app.post('/mcp/tools/list', (req, res) => {
  console.log('🔧 MCP Tools list request received');
  res.json({
    tools: TOOLS
  });
});

// MCP Call Tool endpoint
app.post('/mcp/tools/call', async (req, res) => {
  const { name, arguments: args } = req.body;
  console.log(`⚡ MCP Tool called: ${name}`, args);

  try {
    let result;

    switch (name) {
      case 'list_files':
        result = await listFiles();
        break;
      
      case 'delete_file':
        result = await deleteFile(args.filename);
        break;
      
      case 'upload_file':
        result = {
          success: true,
          message: "File upload endpoint ready. Use POST /upload with multipart/form-data to upload files.",
          instructions: args.instructions || "No instructions provided",
          uploadEndpoint: "/upload"
        };
        break;
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    res.json({
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    });

  } catch (error) {
    console.error('❌ Tool execution error:', error);
    res.status(500).json({
      error: {
        code: "TOOL_ERROR",
        message: error.message
      }
    });
  }
});

// Regular file upload endpoint (for web interface)
app.post('/upload', upload.any(), (req, res) => {
  try {
    const files = req.files;
    const instructions = req.body.instructions;
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};

    console.log('\n📦 New Upload Received:');
    console.log('Files:', files.length);
    console.log('Instructions:', instructions);

    const processedFiles = files.map(file => ({
      originalName: file.originalname,
      savedAs: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      path: file.path
    }));

    processedFiles.forEach(file => {
      console.log(`  ✓ ${file.originalName} (${(file.size / 1024).toFixed(2)} KB)`);
    });

    // Broadcast to SSE clients
    broadcastSSE('upload', {
      fileCount: files.length,
      files: processedFiles,
      instructions: instructions,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Successfully uploaded ${files.length} file(s)`,
      fileCount: files.length,
      files: processedFiles,
      instructions: instructions,
      metadata: metadata,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper functions
async function listFiles() {
  const files = fs.readdirSync(uploadsDir);
  const fileDetails = files.map(filename => {
    const filepath = path.join(uploadsDir, filename);
    const stats = fs.statSync(filepath);
    return {
      name: filename,
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      created: stats.birthtime,
      modified: stats.mtime
    };
  });

  return {
    success: true,
    count: fileDetails.length,
    files: fileDetails,
    timestamp: new Date().toISOString()
  };
}

async function deleteFile(filename) {
  const filepath = path.join(uploadsDir, filename);
  
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    
    // Broadcast deletion to SSE clients
    broadcastSSE('file_deleted', {
      filename: filename,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: true,
      message: `File ${filename} deleted successfully`,
      timestamp: new Date().toISOString()
    };
  } else {
    throw new Error('File not found');
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function sendSSE(res, event, data) {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (error) {
    console.error('❌ Error sending SSE:', error);
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

// Health check with detailed info
app.get('/', (req, res) => {
  res.json({
    status: 'MCP Server Running',
    message: 'Origin Brain Trainer MCP Server',
    version: '1.0.0',
    protocol: 'MCP with SSE',
    activeConnections: sseClients.size,
    endpoints: {
      sse: '/sse',
      initialize: '/mcp/initialize',
      tools_list: '/mcp/tools/list',
      tools_call: '/mcp/tools/call',
      upload: '/upload',
      files: '/files'
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Keep-alive endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// List files endpoint
app.get('/files', async (req, res) => {
  try {
    const result = await listFiles();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete file endpoint
app.delete('/files/:filename', async (req, res) => {
  try {
    const result = await deleteFile(req.params.filename);
    res.json(result);
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM received, closing server...');
  sseClients.forEach((client, clientId) => {
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
║   Protocol: MCP with SSE + Heartbeat      ║
║   SSE endpoint: /sse                      ║
║   Upload endpoint: /upload                ║
╚═══════════════════════════════════════════╝
  `);
});
