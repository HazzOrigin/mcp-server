const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (adjust in production)
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'MCP Server Running',
    message: 'Origin Brain Trainer MCP Server',
    version: '1.0.0',
    endpoints: {
      upload: '/upload',
      files: '/files'
    }
  });
});

// File upload endpoint
app.post('/upload', upload.any(), (req, res) => {
  try {
    const files = req.files;
    const instructions = req.body.instructions;
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};

    console.log('\n📦 New Upload Received:');
    console.log('Files:', files.length);
    console.log('Instructions:', instructions);
    console.log('Metadata:', metadata);

    // Process each file
    const processedFiles = files.map(file => ({
      originalName: file.originalname,
      savedAs: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      path: file.path
    }));

    // Log file details
    processedFiles.forEach(file => {
      console.log(`  ✓ ${file.originalName} (${(file.size / 1024).toFixed(2)} KB)`);
    });

    // Here you can add your custom processing logic:
    // - Extract metadata
    // - Index for search
    // - Process with AI
    // - Store in database
    // - etc.

    // Send success response
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
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List all uploaded files
app.get('/files', (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const fileDetails = files.map(filename => {
      const filepath = path.join(uploadsDir, filename);
      const stats = fs.statSync(filepath);
      return {
        name: filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    });

    res.json({
      success: true,
      count: fileDetails.length,
      files: fileDetails
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete a file
app.delete('/files/:filename', (req, res) => {
  try {
    const filepath = path.join(uploadsDir, req.params.filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🚀 MCP Server Running                   ║
║   Port: ${PORT}                              ║
║   Upload endpoint: /upload                ║
║   Files endpoint: /files                  ║
╚═══════════════════════════════════════════╝
  `);
});
