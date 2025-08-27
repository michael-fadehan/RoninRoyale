"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // trigger reflow for entry animation
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div className={`page-transition ${visible ? 'enter' : 'exit'}`} key={pathname}>
      <style>{`
        /* Avoid using transform on the wrapper so fixed-position header remains fixed to viewport */
        .page-transition { transition: opacity 320ms ease; opacity: 0; }
        .page-transition.enter { opacity: 1; }
        .page-transition.exit { opacity: 0; }
      `}</style>
      {children}
    </div>
  );
}


