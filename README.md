# Origin Brain Trainer - MCP Server

A simple Node.js server to receive file uploads from the Origin Brain Trainer.

## 🚀 Quick Deploy to Railway

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial MCP server"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mcp-server.git
git push -u origin main
```

### 2. Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `mcp-server` repository
5. Wait 2-3 minutes
6. Click "Settings" → "Generate Domain"
7. Copy your URL!

### 3. Update Origin Brain Trainer

Edit `index.html` in your Origin Brain Trainer repo:

```html
value="https://your-railway-url.up.railway.app/upload"
```

Done! 🎉

## 💻 Local Development

```bash
npm install
npm start
```

Server runs at: `http://localhost:3000`

## 📡 API Endpoints

### POST `/upload`
Upload files with instructions

**Request:**
- Content-Type: `multipart/form-data`
- Files: Multiple files
- Body:
  - `instructions`: String (optional)
  - `metadata`: JSON string (optional)

**Response:**
```json
{
  "success": true,
  "message": "Successfully uploaded 2 file(s)",
  "fileCount": 2,
  "files": [...],
  "timestamp": "2025-01-13T..."
}
```

### GET `/`
Health check

**Response:**
```json
{
  "status": "MCP Server Running",
  "message": "Origin Brain Trainer MCP Server",
  "version": "1.0.0"
}
```

### GET `/files`
List all uploaded files

### DELETE `/files/:filename`
Delete a specific file

## 🔧 Environment Variables

- `PORT` - Server port (default: 3000, Railway sets automatically)

## 📦 File Storage

Files are stored in the `uploads/` directory. 

**Note:** Railway's filesystem is ephemeral. Files will be deleted when the server restarts. For permanent storage, consider:
- AWS S3
- Cloudflare R2
- Google Cloud Storage

## 🔒 Security Notes

**For Production:**

1. **Limit CORS origins** (edit `server.js`):
   ```javascript
   app.use(cors({
     origin: 'https://hazzorigin.github.io'
   }));
   ```

2. **Add API authentication**
3. **Add rate limiting**
4. **Scan uploaded files**

## 💰 Cost

Railway Hobby Plan: **$5/month**
- Includes $5 usage credit
- Most hobby projects stay at $5/month

## 🆘 Troubleshooting

**Deployment fails:**
- Check Railway logs
- Verify `package.json` is correct

**Upload fails:**
- Check CORS settings
- View Railway logs for errors
- Test with Postman first

**Files disappear:**
- Railway filesystem is temporary
- Use cloud storage for permanence

## 📚 Learn More

- [Railway Docs](https://docs.railway.app)
- [Express.js](https://expressjs.com)
- [Multer](https://github.com/expressjs/multer)

---

Built with ❤️ for Origin Brain Trainer
