# 🚀 Deploy MCP ChatGPT Server - Step by Step

## What This Server Does:

✅ Works with **ChatGPT's MCP integration** (SSE protocol)
✅ Works with **Origin Brain Trainer web interface** (file uploads)
✅ Provides tools for ChatGPT to list, upload, and delete files
✅ Real-time updates via Server-Sent Events

---

## Step 1: Push to GitHub

1. Go to: https://github.com/new
2. Repository name: `mcp-chatgpt-server`
3. Make it **Public**
4. Click **"Create repository"**

Then upload all files or use terminal:
```bash
cd mcp-chatgpt-server
git init
git add .
git commit -m "MCP ChatGPT server with SSE"
git branch -M main
git remote add origin https://github.com/HazzOrigin/mcp-chatgpt-server.git
git push -u origin main
```

## Step 2: Deploy to Railway

1. Go to: https://railway.app
2. Sign in with GitHub
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose **"HazzOrigin/mcp-chatgpt-server"**
6. Wait 2-3 minutes for deployment

## Step 3: Get Your Server URL

1. Click **"Settings"** tab
2. Scroll to **"Networking"**
3. Click **"Generate Domain"**
4. Copy URL (e.g., `mcp-chatgpt-server-production-abc123.up.railway.app`)

## Step 4: Test the Server

Visit: `https://your-railway-url.up.railway.app`

You should see:
```json
{
  "status": "MCP Server Running",
  "protocol": "MCP with SSE",
  "endpoints": {
    "sse": "/sse",
    "upload": "/upload"
  }
}
```

✅ **Server is working!**

---

## Step 5: Connect to ChatGPT

### A) Enable MCP in ChatGPT

1. Open **ChatGPT**
2. Click your **profile icon** (bottom left)
3. Go to **Settings**
4. Click **"Beta Features"**
5. Enable **"Model Context Protocol"**

### B) Add Your Server

1. In Settings, go to **"MCP Servers"** (or similar)
2. Click **"Add Server"** or **"+"**
3. Fill in:
   - **Server Name:** `Origin Brain Trainer`
   - **Server URL:** `https://your-railway-url.up.railway.app/sse`
   - **Protocol Type:** `SSE` or `Server-Sent Events`

4. Click **"Connect"** or **"Add"**

### C) Verify Connection

ChatGPT should show:
- ✅ "Connected to Origin Brain Trainer"
- Available tools: upload_file, list_files, delete_file

---

## Step 6: Test with ChatGPT

Try these commands in ChatGPT:

**"List all files uploaded to Origin Brain Trainer"**

**"What tools are available on the Origin Brain Trainer server?"**

ChatGPT should use the MCP tools to respond!

---

## Step 7: Update Origin Brain Trainer

### Update Default Server URL:

1. Go to: https://github.com/HazzOrigin/origin-brain-trainer
2. Edit **`index.html`**
3. Find line ~27:
   ```html
   value="https://mcp-server-production-067c.up.railway.app/upload"
   ```
4. Change to:
   ```html
   value="https://your-new-chatgpt-server-url.up.railway.app/upload"
   ```
5. Commit changes

### Test the Web Interface:

1. Go to: https://hazzorigin.github.io/origin-brain-trainer/
2. Drag and drop a file
3. Add instructions
4. Click "Upload to MCP"
5. Should see success! ✅

---

## How It All Works Together:

```
┌─────────────────────────────────────────┐
│  Origin Brain Trainer (Web)             │
│  https://hazzorigin.github.io/...       │
└────────────┬────────────────────────────┘
             │ POST /upload (files)
             ▼
┌─────────────────────────────────────────┐
│  MCP Server on Railway                  │
│  - Stores files                         │
│  - Provides MCP tools                   │
│  - Sends SSE updates                    │
└────────────┬────────────────────────────┘
             │ SSE stream (/sse)
             ▼
┌─────────────────────────────────────────┐
│  ChatGPT                                │
│  - Lists files                          │
│  - Gets upload notifications            │
│  - Can delete files                     │
└─────────────────────────────────────────┘
```

---

## 🆘 Troubleshooting

### ChatGPT Connection Error:

**Error:** "Expected response header Content-Type to contain 'text/event-stream'"

**Fix:** Make sure you're using `/sse` at the end:
- ✅ `https://your-url.up.railway.app/sse`
- ❌ `https://your-url.up.railway.app`

### Upload Not Working:

**Check:**
1. Railway logs (click Deployments → View Logs)
2. Browser console for CORS errors
3. File size (max 50MB)

### SSE Keeps Disconnecting:

**Normal!** SSE reconnects automatically. This is expected behavior.

---

## 💰 Cost

- Railway: **$5/month** (Hobby plan)
- One server handles both web uploads AND ChatGPT integration

---

## 🎉 Success Checklist

- [ ] Server deployed to Railway
- [ ] Server URL generated
- [ ] Health check works (visit root URL)
- [ ] MCP connected to ChatGPT
- [ ] ChatGPT can list files
- [ ] Origin Brain Trainer default URL updated
- [ ] File upload from web works
- [ ] ChatGPT receives upload notifications

---

## Next Steps

1. Add authentication (API keys)
2. Set up permanent storage (S3/R2)
3. Add file processing logic
4. Create more MCP tools

**Need help?** Check the README.md or Railway logs!
