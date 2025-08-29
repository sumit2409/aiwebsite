import { GetStaticProps } from 'next';
import Link from 'next/link';
import Layout from '../components/Layout';
import { listPosts, PostMeta } from '../lib/md';

type Props = { posts: PostMeta[] };

export default function Archive({ posts }: Props) {
  return (
    <Layout>
      <h2>Archive</h2>
      {!posts.length ? <p>No posts yet.</p> : (
        <ul>
          {posts.map(p => (
            <li key={p.slug} style={{ marginBottom: 10 }}>
              <Link href={`/${p.slug}`}>{p.title}</Link> <small>— {new Date(p.date).toDateString()}</small>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  return { props: { posts: listPosts() } };
};
