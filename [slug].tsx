import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Layout from '../components/Layout';
import { getPost, listSlugs } from '../lib/md';

export default function PostPage({ post }: { post: any }) {
  if (!post) return <Layout><p>Not found.</p></Layout>;
  return (
    <Layout>
      <Head>
        <title>{post.title}</title>
        <meta name="description" content={post.headline || 'Daily trending story'} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.headline || ''} />
      </Head>
      <article>
        <h2>{post.title}</h2>
        {post.headline && <p style={{ fontStyle: 'italic' }}>{post.headline}</p>}
        <p><small>{new Date(post.date).toDateString()}</small></p>
        <div dangerouslySetInnerHTML={{ __html: post.html }} />
      </article>
    </Layout>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const files = listSlugs();
  const paths = files.map(f => ({ params: { slug: f.replace(/\.md$/, '') } }));
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (ctx) => {
  const slug = ctx.params?.slug as string;
  const post = await getPost(slug);
  return { props: { post } };
};
