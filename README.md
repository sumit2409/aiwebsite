# aiwebsite

Daily AI-generated, sourced news explainer.

## What this repo does
- **Generates** one daily article from the last 48h of news (scripts/generateDaily.mts).
- **Commits** the article into `content/daily/` via GitHub Actions.
- **Deploys** the site to **GitHub Pages** (static Next.js export).

## Quick start
```bash
npm i
npm run dev
```

Copy `.env.example` to `.env` locally if you want to run the generator.

## Deploy to GitHub Pages
- Repo Settings → Pages → Source: **GitHub Actions**.
- Push to `main` and the provided `deploy.yml` will publish to Pages.
- The URL will be `https://<your-username>.github.io/aiwebsite/`.

## Secrets (GitHub → Settings → Secrets → Actions)
- `OPENAI_API_KEY` (required)
- `NEWSAPI_KEY` (optional but recommended)
- `MEDIASTACK_KEY` (optional)

The daily workflow (`.github/workflows/daily.yml`) generates and commits an article, which triggers the deploy workflow.
