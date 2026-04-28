# My Dashboard

A personal student dashboard with Google Calendar, Google Classroom, Gmail, market data, and an AI assistant — hosted on GitHub Pages.

---

## Quick Setup

### 1. Deploy to GitHub Pages
1. Upload all files (`index.html`, `style.css`, `app.js`) to your GitHub repo
2. Go to **Settings → Pages**, set source to `main` branch, root folder
3. Your site will be live at `https://yourusername.github.io/repo-name/`

---

### 2. Google Integration (Calendar + Classroom + Gmail)

One setup unlocks all three Google services.

**Step-by-step:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (name it anything)
3. Go to **APIs & Services → Library** and enable:
   - Google Calendar API
   - Google Classroom API
   - Gmail API
4. Go to **APIs & Services → OAuth consent screen**
   - Choose **External**
   - Fill in app name and your email
   - Add scopes: Calendar (read), Classroom coursework (read), Gmail (read)
   - Add your email as a test user
5. Go to **Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: add your GitHub Pages URL (e.g. `https://yourusername.github.io`)
   - Also add `http://localhost` if you want to test locally
6. Copy the **Client ID**
7. On your dashboard, go to **Settings** and paste it in the Google Client ID field
8. Click **Save & Connect** — it will redirect you to sign in with Google

> ⚠️ Your token is stored only in your browser's localStorage. It is never sent to any server other than Google's.

---

### 3. AI Assistant (Claude)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account and generate an API key
3. In your dashboard **Settings**, paste it in the Anthropic API Key field
4. The AI chat panel will now work

> ⚠️ Keep your API key private. Don't share your screen while it's visible.

---

### 4. Market Data (Finnhub)

1. Go to [finnhub.io](https://finnhub.io) and create a free account
2. Copy your API key from the dashboard
3. In your dashboard **Settings**, paste it in the Finnhub API Key field
4. S&P 500, NASDAQ, and Dow data will load automatically

**For your portfolio:**
- In Settings → Portfolio Holdings, add each stock you own
- Enter the ticker symbol, number of shares, and your average cost per share
- The dashboard will calculate your total portfolio value and gain/loss

---

### 5. PowerSchool (Grades)

PowerSchool doesn't offer a public API, so grades are entered manually:
1. Go to the **Grades** section
2. Click **Edit Grades**
3. Enter your class names, percentage scores, and teacher names
4. Your grades are saved in your browser and persist between visits

---

## Privacy & Security

- **All API keys are stored in your browser's `localStorage` only** — they never leave your device except to talk directly to the respective service (Google, Anthropic, Finnhub)
- **Nothing is stored on any server** — this is a purely static site
- **Your GitHub repo contains no secrets** — keys are entered through the Settings UI after the site loads
- Since the site is **public on GitHub Pages**, anyone with the URL can visit it — but they won't see your data unless they also have your API keys

> If you want the site to be private (URL not publicly guessable), consider using a private repo with GitHub Pages (requires GitHub Pro) or just keeping the URL to yourself — it won't appear in search engines unless you link to it publicly.

---

## File Structure

```
/
├── index.html      — All HTML structure
├── style.css       — All styles (clean minimal theme)
├── app.js          — All JavaScript logic
└── README.md       — This file
```

---

## What's Included

| Feature | Status |
|---|---|
| Daily agenda / today's events | ✅ Google Calendar |
| Monthly calendar view | ✅ With event dots |
| Add events | ✅ Google Calendar or local |
| Assignments list | ✅ Google Classroom |
| Missing work alerts | ✅ Auto-detected |
| Grades tracker | ✅ Manual (PowerSchool workaround) |
| Email digest | ✅ Gmail unread |
| AI email summarization | ✅ One-click with Claude |
| Market overview | ✅ S&P, NASDAQ, Dow |
| Portfolio tracker | ✅ Custom holdings |
| AI chat assistant | ✅ Claude-powered |
| Settings panel | ✅ All keys managed in-browser |
