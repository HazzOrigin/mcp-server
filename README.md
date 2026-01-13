# Origin Brain Trainer - MCP Server (ChatGPT Compatible)

A proper MCP (Model Context Protocol) server with SSE support for ChatGPT integration + file upload API for Origin Brain Trainer web interface.

## 🚀 Quick Deploy to Railway

### 1. Create GitHub Repository

```bash
cd mcp-chatgpt-server
git init
git add .
git commit -m "Initial MCP ChatGPT server"
git branch -M main
git remote add origin https://github.com/HazzOrigin/mcp-chatgpt-server.git
git push -u origin main
```

### 2. Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `mcp-chatgpt-server`
5. Wait 2-3 minutes
6. Generate Domain
7. Copy your URL: `https://mcp-chatgpt-server-production.up.railway.app`

## 🔌 Connect to ChatGPT

### Step 1: Get Your Server URL

After deploying to Railway, you'll have a URL like:
`https://mcp-chatgpt-server-production-xxxx.up.railway.app`

### Step 2: Add to ChatGPT

1. Open ChatGPT
2. Click your profile → Settings
3. Go to "Beta Features"
4. Enable "Model Context Protocol"
5. Click "Add MCP Server"
6. Enter:
   - **Name:** Origin Brain Trainer
   - **URL:** `https://your-railway-url.up.railway.app/sse`
   - **Type:** SSE

### Step 3: Test It

In ChatGPT, try:
- "List all uploaded files"
- "Upload a file with instructions to process it"
- "Delete file [filename]"

## 📡 Available Endpoints

### For ChatGPT (MCP Protocol):

- **GET `/sse`** - Server-Sent Events stream
- **POST `/mcp/initialize`** - Initialize MCP connection
- **POST `/mcp/tools/list`** - List available tools
- **POST `/mcp/tools/call`** - Call a tool

### For Web Interface:

- **GET `/`** - Health check
- **POST `/upload`** - Upload files (multipart/form-data)
- **GET `/files`** - List all files
- **DELETE `/files/:filename`** - Delete a file

## 🛠️ Available MCP Tools

### 1. upload_file
Upload files with processing instructions.

**Input:**
```json
{
  "instructions": "Process these files and extract metadata"
}
```

### 2. list_files
List all uploaded files with details.

### 3. delete_file
Delete a specific file.

**Input:**
```json
{
  "filename": "example.pdf"
}
```

## 💻 Local Development

```bash
npm install
npm start
```

Server runs at: `http://localhost:3000`

Test SSE: `curl http://localhost:3000/sse`

## 🌐 Update Origin Brain Trainer

Edit `index.html` in your Origin Brain Trainer:

```html
value="https://your-railway-url.up.railway.app/upload"
```

## 🔒 Security Notes

**For Production:**

1. **Add authentication:**
```javascript
const API_KEY = process.env.API_KEY;
app.use((req, res, next) => {
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

2. **Limit CORS:**
```javascript
app.use(cors({
  origin: ['https://hazzorigin.github.io', 'https://chat.openai.com']
}));
```

3. **Rate limiting**
4. **File validation**

## 📊 How It Works

### MCP Protocol Flow:

1. **Initialize:** ChatGPT connects to `/mcp/initialize`
2. **Discover Tools:** Calls `/mcp/tools/list` to see available tools
3. **Execute:** Calls `/mcp/tools/call` to run tools
4. **Stream Updates:** Receives real-time updates via `/sse`

### Web Upload Flow:

1. User drags files to Origin Brain Trainer
2. Files sent to `/upload` endpoint
3. Server stores files and broadcasts via SSE
4. ChatGPT receives notification through SSE stream

## 🆘 Troubleshooting

**ChatGPT can't connect:**
- Make sure URL ends with `/sse`
- Check Railway logs for CORS errors
- Verify server is responding: `curl https://your-url.up.railway.app/`

**Upload fails:**
- Check file size (max 50MB)
- Verify CORS is enabled
- Check Railway logs

**SSE connection drops:**
- Normal behavior - SSE reconnects automatically
- Check Railway keeps service alive

## 💰 Cost

Railway Hobby Plan: **$5/month**
- Includes $5 usage credit
- Perfect for hobby projects

## 📚 Learn More

- [MCP Protocol Docs](https://modelcontextprotocol.io)
- [Railway Docs](https://docs.railway.app)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

---

Built with ❤️ for Origin Brain Trainer + ChatGPT
