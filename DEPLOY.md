# 🎯 DEPLOY TO RAILWAY - STEP BY STEP

Follow these exact steps to get your MCP server running on Railway.

## Step 1: Extract the ZIP

1. Download the `mcp-server-github.zip` file
2. Extract it to your computer
3. You should see these files:
   - `server.js`
   - `package.json`
   - `.gitignore`
   - `README.md`
   - `DEPLOY.md` (this file)

## Step 2: Create GitHub Repository

1. Go to: https://github.com/new
2. Repository name: `mcp-server`
3. Make it **Public**
4. **DON'T** check any boxes
5. Click **"Create repository"**

## Step 3: Upload to GitHub

**Option A - Upload via GitHub Web:**
1. On your new empty repository page, click "uploading an existing file"
2. Drag ALL the files into the upload area
3. Click "Commit changes"

**Option B - Push via Terminal:**
```bash
cd mcp-server
git init
git add .
git commit -m "Initial MCP server"
git branch -M main
git remote add origin https://github.com/HazzOrigin/mcp-server.git
git push -u origin main
```

## Step 4: Deploy to Railway

1. Go to: https://railway.app
2. Click **"Login"** → Sign in with **GitHub**
3. Click **"New Project"**
4. Click **"Deploy from GitHub repo"**
5. Select **"HazzOrigin/mcp-server"**
6. Click **"Deploy Now"**

Railway will automatically:
- Detect Node.js
- Install dependencies
- Start the server

Wait 2-3 minutes...

## Step 5: Get Your Server URL

1. Click on your deployed project
2. Click the **"Settings"** tab
3. Scroll down to **"Networking"** section
4. Click **"Generate Domain"**
5. Copy the URL (looks like: `mcp-server-production-xxxx.up.railway.app`)

## Step 6: Test Your Server

1. Open a new tab
2. Visit: `https://your-railway-url.up.railway.app`
3. You should see:
   ```json
   {
     "status": "MCP Server Running",
     "message": "Origin Brain Trainer MCP Server"
   }
   ```

✅ **Server is working!**

## Step 7: Connect to Origin Brain Trainer

1. Go to: https://github.com/HazzOrigin/origin-brain-trainer
2. Click on **`index.html`**
3. Click the **✏️ pencil icon** (Edit this file)
4. Find line ~27 that says:
   ```html
   value="https://your-mcp-server.com/upload"
   ```
5. Change it to:
   ```html
   value="https://your-actual-railway-url.up.railway.app/upload"
   ```
6. Scroll down and click **"Commit changes"**

## Step 8: Test the Complete System

1. Go to: https://hazzorigin.github.io/origin-brain-trainer/
2. The server URL should now be filled in automatically
3. Drag and drop a test file
4. Add some instructions (optional)
5. Click **"Upload to MCP"**
6. You should see: ✅ **"Successfully uploaded 1 file(s) to MCP server"**

## 🎉 Done!

Your complete system is now live:
- ✅ Frontend: https://hazzorigin.github.io/origin-brain-trainer/
- ✅ Backend: https://your-railway-url.up.railway.app

## 💰 Billing

Railway will charge ~$5/month for the Hobby plan.

## 🔍 View Logs

To see uploads happening in real-time:
1. Go to Railway dashboard
2. Click your project
3. Click **"Deployments"** tab
4. Click **"View Logs"**

You'll see messages like:
```
📦 New Upload Received:
Files: 1
  ✓ test.pdf (234.56 KB)
```

## ❓ Having Issues?

**Server won't start:**
- Check Railway logs for errors
- Verify all files were uploaded

**Upload fails:**
- Make sure you used the `/upload` endpoint in the URL
- Check Railway logs

**Need help?** Open an issue on GitHub!

---

**Next Steps:**
- Add authentication to your server
- Set up permanent file storage (S3, R2)
- Add processing logic for your files
