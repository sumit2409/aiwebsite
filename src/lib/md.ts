import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';

const postsDir = path.join(process.cwd(), 'content', 'daily');

export type PostMeta = {
  slug: string;
  title: string;
  headline?: string;
  date: string;
  primarySource?: string;
  primaryUrl?: string;
};

export type Post = PostMeta & { html: string; content: string; };

export function listSlugs(): string[] {
  if (!fs.existsSync(postsDir)) return [];
  return fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
}

export function listPosts(): PostMeta[] {
  const files = listSlugs();
  const posts = files.map((fname) => {
    const filePath = path.join(postsDir, fname);
    const raw = fs.readFileSync(filePath, 'utf8');
    const { data } = matter(raw);
    const slug = fname.replace(/\.md$/, '');
    return {
      slug,
      title: (data.title as string) || slug,
      headline: data.headline as string | undefined,
      date: (data.date as string) || '1970-01-01',
      primarySource: data.primarySource as string | undefined,
      primaryUrl: data.primaryUrl as string | undefined,
    };
  });
  return posts.sort((a,b)=> (a.date < b.date ? 1 : -1));
}

export async function getPost(slug: string): Promise<Post | null> {
  const filePath = path.join(postsDir, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);
  const processed = await remark().use(html).process(content);
  const htmlContent = processed.toString();
  return {
    slug,
    title: (data.title as string) || slug,
    headline: data.headline as string | undefined,
    date: (data.date as string) || '1970-01-01',
    primarySource: data.primarySource as string | undefined,
    primaryUrl: data.primaryUrl as string | undefined,
    html: htmlContent,
    content,
  };
}
