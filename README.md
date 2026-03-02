# 🍳 Notion Recipe Finder — Setup Guide

A mobile-first web app that connects to your Notion recipe database and finds recipes you can make with the ingredients in your fridge.

---

## What You'll Need

- Node.js 18+ installed ([download here](https://nodejs.org))
- A Notion account with a recipe database
- 10–15 minutes

---

## Step 1 — Prepare Your Notion Database

Your recipe database needs an **Ingredients** property of type **Multi-select**, where each ingredient is a separate tag.

**Example recipe row:**
| Name | Ingredients | Tags | Time |
|------|------------|------|------|
| Pasta Carbonara | eggs, pasta, parmesan, pancetta, black pepper | Italian, Dinner | 30 min |

> If your database uses a different name (e.g. "Main Ingredients"), that's fine — you'll set it in the `.env` file.

**Optional but supported properties:**
- `Tags` or `Category` or `Cuisine` — Multi-select
- `Time` or `Cook Time` — Select or Text
- `Servings` or `Serves` — Number or Text

---

## Step 2 — Create a Notion Integration

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Give it a name: `Recipe Finder`
4. Set **Capabilities**: ✅ Read content (no write needed)
5. Click **Submit**
6. Copy the **"Internal Integration Token"** (starts with `secret_...`)

**Connect it to your database:**
1. Open your recipe database in Notion
2. Click the `•••` menu (top right) → **Connections** → search for `Recipe Finder` → click Connect

---

## Step 3 — Get Your Database ID

1. Open your recipe database in Notion (make sure it's the database page, not a filtered view)
2. Copy the URL — it looks like:
   ```
   https://www.notion.so/yourname/abc123def456...789xyz?v=...
   ```
3. The **Database ID** is the 32-character string between the last `/` and the `?`
   ```
   abc123def456...789xyz  ← this part
   ```

---

## Step 4 — Set Up the Backend

```bash
# Navigate to backend folder
cd recipe-app/backend

# Install dependencies
npm install

# Create your .env file from the template
cp .env.example .env
```

Now open `backend/.env` and fill in your values:

```env
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID=abc123def456789xyz
INGREDIENTS_PROPERTY=Ingredients   # Change if your property has a different name
PORT=3001
```

Start the backend:
```bash
npm run dev
```

✅ You should see: `🍳 Recipe API running on http://localhost:3001`

**Test it works:**
```bash
curl http://localhost:3001/api/ingredients
# Should return a JSON list of all your ingredient tags
```

---

## Step 5 — Set Up the Frontend

Open a **new terminal tab**:

```bash
cd recipe-app/frontend

# Install dependencies
npm install

# Create your .env file
cp .env.example .env
# The default (http://localhost:3001) is correct for local development
```

Start the frontend:
```bash
npm start
```

Your browser will open at [http://localhost:3000](http://localhost:3000) 🎉

---

## How to Use the App

1. **My Fridge tab** — Tap ingredients you currently have. Use the search bar to find them quickly. Hit "Find Recipes →"
2. **Recipes tab** — See all your recipes sorted by how many ingredients you have:
   - **✓ Ready** — You have everything!
   - **Almost** — You have ≥50% of ingredients
   - Tap any card to see a breakdown of what you have vs. what you're missing
   - Tap "Open in Notion" to see the full recipe

---

## Folder Structure

```
recipe-app/
├── backend/
│   ├── server.js          # Express API — Notion connection + matching logic
│   ├── package.json
│   └── .env.example       # Copy to .env and fill in your values
│
└── frontend/
    ├── src/
    │   ├── App.jsx        # Main React app (UI, fridge picker, recipe cards)
    │   └── App.css        # All styling
    ├── public/
    │   └── index.html
    ├── package.json
    └── .env.example       # Copy to .env (set API URL)
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingredients` | GET | All unique ingredient tags from your Notion DB |
| `/api/recipes` | GET | All recipes with properties |
| `/api/match` | POST | Match fridge ingredients to recipes |

---

## Deploying (Optional — Access on your phone anywhere)

### Option A — Railway (easiest, free tier)
1. Push to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add your environment variables in the Railway dashboard
4. Deploy! You'll get a public URL like `https://your-app.railway.app`
5. Update `frontend/.env`: `REACT_APP_API_URL=https://your-app.railway.app`
6. Run `npm run build` in the frontend and deploy that too (or use Netlify/Vercel for the frontend)

### Option B — Use it locally on your phone
1. Find your computer's local IP: `ipconfig` (Windows) or `ifconfig` (Mac)
2. Update `frontend/.env`: `REACT_APP_API_URL=http://YOUR_IP:3001`
3. Rebuild: `npm run build && npx serve -s build`
4. Visit `http://YOUR_IP:3000` on your phone (must be same WiFi)

---

## Phase 2 — AI Ingredient Parsing (Coming Next!)

The next step is adding an endpoint that:
1. Reads the full text body of each Notion recipe page
2. Uses Claude AI to extract the ingredients list
3. Optionally writes them back to your multi-select property

This means you won't need to manually tag every recipe — just paste in a recipe and the AI handles it.

---

## Troubleshooting

**"Failed to load from Notion"**
- Is the backend running? (`npm run dev` in the backend folder)
- Is your `NOTION_TOKEN` correct?
- Did you connect the integration to your database? (Step 2)

**"Property not found or not a multi-select"**
- Check `INGREDIENTS_PROPERTY` in `.env` matches the exact name in Notion (case-sensitive)

**Ingredients list is empty**
- Make sure at least one recipe has values in the Ingredients multi-select

**CORS error in browser**
- Make sure the backend is running on port 3001
- Check `REACT_APP_API_URL` in the frontend `.env`
