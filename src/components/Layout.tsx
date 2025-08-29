import React, { PropsWithChildren } from 'react';
import Link from 'next/link';

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1rem', lineHeight: 1.6 }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}><Link href="/">AI Daily Trending News</Link></h1>
        <nav style={{ marginTop: 8 }}>
          <Link href="/">Home</Link> · <Link href="/archive">Archive</Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer style={{ marginTop: '3rem', fontSize: 14, opacity: 0.7 }}>
        <p>AI-assisted. Sources linked in each article.</p>
      </footer>
    </div>
  );
}
