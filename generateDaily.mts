import 'dotenv/config';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { OpenAI } from 'openai';
import fetch from 'node-fetch';
import { differenceInHours, subDays } from 'date-fns';
import { distance } from 'fast-levenshtein';

type Item = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  description?: string;
  content?: string;
};

const OUT_DIR = join(process.cwd(), 'content', 'daily');
const WINDOW_HOURS = 48;

const isoNow = () => new Date().toISOString();
const sinceISO = () => subDays(new Date(), 2).toISOString();

function normalize(items: Item[]): Item[] {
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const it of items) {
    if (!it.title || !it.url) continue;
    const key = it.url.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function sim(a: string, b: string) {
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - distance(a.toLowerCase(), b.toLowerCase()) / maxLen;
}

function dedupeByTitle(items: Item[]): Item[] {
  const kept: Item[] = [];
  for (const it of items.sort((a,b)=> (a.publishedAt < b.publishedAt ? 1 : -1))) {
    const isDup = kept.some(k => sim(it.title, k.title) >= 0.85);
    if (!isDup) kept.push(it);
  }
  return kept;
}

function scoreItem(it: Item): number {
  const hours = differenceInHours(new Date(), new Date(it.publishedAt));
  const recency = Math.exp(-hours / 18);
  const priorMap: Record<string, number> = {
    'reuters': 0.95, 'ap news': 0.95, 'associated press': 0.95,
    'bbc news': 0.9, 'bloomberg': 0.9, 'npr': 0.9, 'the guardian': 0.85
  };
  const prior = priorMap[(it.source || '').toLowerCase()] ?? 0.55;
  const richness = ((it.description || '').length + (it.content || '').length) > 400 ? 1 : 0.6;
  return 0.45*recency + 0.4*prior + 0.15*richness;
}

function cluster(items: Item[]): Item[][] {
  const groups: Item[][] = [];
  for (const it of items) {
    let placed = false;
    for (const g of groups) {
      if (sim(it.title, g[0].title) >= 0.45) { g.push(it); placed = true; break; }
    }
    if (!placed) groups.push([it]);
  }
  return groups;
}

function pickTop(items: Item[]) {
  const groups = cluster(items);
  let best: Item[] = [];
  let bestScore = -1;
  for (const g of groups) {
    const base = g.map(scoreItem);
    const groupScore = Math.max(...base) + 0.1 * Math.log(g.length + 1);
    if (groupScore > bestScore) { bestScore = groupScore; best = g; }
  }
  const rep = best.sort((a,b)=> scoreItem(b)-scoreItem(a))[0];
  return { rep, group: best, score: bestScore };
}

function mdEscape(s: string) {
  return s.replace(/</g, '&lt;').replace(/"/g, '\"');
}

// --------- Fetchers ---------
async function fetchNewsAPI(): Promise<Item[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];
  const url = new URL('https://newsapi.org/v2/everything');
  url.searchParams.set('q', '*');
  url.searchParams.set('language', process.env.SITE_LANG || 'en');
  url.searchParams.set('pageSize', '100');
  url.searchParams.set('sortBy', 'publishedAt');
  url.searchParams.set('from', sinceISO());
  url.searchParams.set('to', isoNow());
  const r = await fetch(url, { headers: { 'X-Api-Key': key } });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.articles || []).map((a: any) => ({
    title: a.title, url: a.url, source: a.source?.name || 'NewsAPI',
    publishedAt: a.publishedAt, description: a.description || '', content: a.content || ''
  }));
}

async function fetchMediastack(): Promise<Item[]> {
  const key = process.env.MEDIASTACK_KEY;
  if (!key) return [];
  const url = new URL('http://api.mediastack.com/v1/news');
  url.searchParams.set('access_key', key);
  url.searchParams.set('languages', process.env.SITE_LANG || 'en');
  url.searchParams.set('date', `${sinceISO()},${isoNow()}`);
  url.searchParams.set('limit', '100');
  const r = await fetch(url.toString());
  if (!r.ok) return [];
  const j = await r.json();
  return (j.data || []).map((a: any) => ({
    title: a.title, url: a.url, source: a.source || 'MediaStack',
    publishedAt: a.published_at, description: a.description || '', content: ''
  }));
}

async function fetchGDELT(): Promise<Item[]> {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=sourceCountry:US OR sourceCountry:GB&mode=ArtList&maxrecords=100&sourcelang=${process.env.SITE_LANG || 'en'}&format=json`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const j = await r.json();
  return (j.articles || []).map((a: any) => ({
    title: a.title, url: a.url, source: a.sourceCommonName || 'GDELT',
    publishedAt: a.seendate, description: a.socialimage || '', content: ''
  })).filter((it: Item) => differenceInHours(new Date(), new Date(it.publishedAt)) <= WINDOW_HOURS);
}

async function fetchRSS(): Promise<Item[]> {
  const Parser = (await import('rss-parser')).default;
  const parser = new Parser();
  const feeds = [
    'https://feeds.reuters.com/reuters/topNews',
    'https://www.bbc.com/news/10628494',
    'https://www.npr.org/rss/rss.php?id=1001'
  ];
  const out: Item[] = [];
  for (const f of feeds) {
    try {
      const rss = await parser.parseURL(f);
      for (const e of rss.items || []) {
        const pub = (e.isoDate || e.pubDate);
        if (!pub) continue;
        if (differenceInHours(new Date(), new Date(pub)) > WINDOW_HOURS) continue;
        out.push({
          title: e.title || '',
          url: e.link || '',
          source: rss.title || 'RSS',
          publishedAt: new Date(pub).toISOString(),
          description: e.contentSnippet || ''
        });
      }
    } catch {}
  }
  return out;
}

// --------- Generation ---------
async function generateArticle(rep: Item, group: Item[]) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const sourcesList = group
    .sort((a,b)=> (a.publishedAt < b.publishedAt ? 1 : -1))
    .slice(0, 10)
    .map((it, i) => `[${i+1}] ${it.title} — ${it.source} (${it.publishedAt}) ${it.url}`)
    .join('\n');
  const today = new Date().toISOString().slice(0,10);
  const instructions = `You are a careful news writer. Only use the provided sources. Keep a neutral tone. Cite inline like [1], [2] matching Sources. Keep direct quotes <= 25 words. If a claim is not supported by sources, omit it.`;
  const input = `Write 800–1000 words naming the 'Trending Story of ${today}'.

Sources:
${sourcesList}

Structure:
# Trending Story of ${today}: <concise headline>
Dek: one sentence (<=30 words)
What happened
Key numbers & timeline (bulleted)
Why it matters
What’s next
Sources (numbered list with the URLs)

Rules:
- No speculation or fabricated quotes.
- Use only the sources above.`;

  const resp = await client.responses.create({
    model: 'gpt-4.1-mini',
    instructions,
    input,
    temperature: 0.3,
  });

  return (resp.output_text || '').trim();
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  let items: Item[] = [];
  items = items.concat(
    await fetchNewsAPI(),
    await fetchMediastack(),
    await fetchGDELT(),
    await fetchRSS()
  );
  items = normalize(items).filter(it =>
    differenceInHours(new Date(), new Date(it.publishedAt)) <= WINDOW_HOURS
  );
  items = dedupeByTitle(items);
  if (!items.length) throw new Error('No items in last 48h.');
  const { rep, group } = pickTop(items);
  const article = await generateArticle(rep, group);
  const slugBase = rep.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  const date = new Date().toISOString().slice(0,10);
  const filename = `${date}-trending-${slugBase || 'top-story'}.md`;
  const frontmatter = [
    '---',
    `title: "Trending Story of ${date}"`,
    `headline: "${mdEscape(rep.title)}"`,
    `date: "${date}"`,
    `primarySource: "${mdEscape(rep.source)}"`,
    `primaryUrl: "${rep.url}"`,
    '---',
    ''
  ].join('\n');
  writeFileSync(join(OUT_DIR, filename), frontmatter + article, 'utf8');
  console.log('Wrote', join('content', 'daily', filename));
}

function mdEscape(s: string) {
  return s.replace(/</g, '&lt;').replace(/"/g, '\"');
}

main().catch(err => { console.error(err); process.exit(1); });
