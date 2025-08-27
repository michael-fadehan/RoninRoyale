"use client";
import { useRouter } from 'next/router';

export default function GamePage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  return (
    <div style={{ padding: 48 }}>
      <h1>{slug.replace('-', ' ').toUpperCase()}</h1>
      <p>This is a placeholder page for the {slug} game.</p>
    </div>
  );
}


