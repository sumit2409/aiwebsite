import { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Layout from '../components/Layout';
import { listPosts, PostMeta } from '../lib/md';

type Props = { latest: PostMeta | null };

export default function Home({ latest }: Props) {
  return (
    <Layout>
      <Head>
        <title>AI Daily Trending News</title>
        <meta name="description" content="One sourced explainer every day." />
      </Head>
      {!latest ? (
        <p>No articles yet.</p>
      ) : (
        <article>
          <h2>
            <Link href={`/${latest.slug}`}>{latest.title}</Link>
          </h2>
          {latest.headline && <p style={{ fontStyle: 'italic' }}>{latest.headline}</p>}
          <p><small>{new Date(latest.date).toDateString()}</small></p>
          {latest.primaryUrl && (
            <p><a href={latest.primaryUrl} target="_blank" rel="noopener noreferrer">Primary source</a></p>
          )}
          <p><Link href="/archive">Browse the archive →</Link></p>
        </article>
      )}
    </Layout>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const posts = listPosts();
  return { props: { latest: posts[0] || null } };
};
