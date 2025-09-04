"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import ParticleBackground from './ParticleBackground';
import RouteTransition from './RouteTransition';

export default function PageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // pick overlay image and tint per route
  let overlayImage = '/assets/section-illustration.svg';
  let overlayOpacity = 0.18;
  let overlayTint = 'rgba(0,0,0,0)';
  if (pathname?.startsWith('/staking')) {
    overlayImage = '';
    overlayOpacity = 0.22;
    overlayTint = 'rgba(12,12,12,0.12)';
  } else if (pathname?.startsWith('/profile')) {
    overlayImage = '/assets/section-illustration2.svg';
    overlayOpacity = 0.24;
    overlayTint = 'rgba(0,0,0,0.14)';
  } else if (pathname?.startsWith('/games')) {
    overlayImage = '';
    overlayOpacity = 0.16;
    overlayTint = 'rgba(0,0,0,0.08)';
  }

  // Suppress overlay entirely on the Coinflip page
  if (pathname === '/games/coinflip' || pathname?.startsWith('/games/coinflip')) {
    overlayImage = '';
    overlayOpacity = 0;
    overlayTint = 'rgba(0,0,0,0)';
  }

  return (
    <>
      <ParticleBackground />
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {overlayTint !== 'rgba(0,0,0,0)' && (
          <div style={{ position: 'absolute', inset: 0, background: overlayTint }} />
        )}
        {overlayImage && overlayOpacity > 0 ? (
          <div style={{ position: 'absolute', right: '-6%', bottom: '-60px', width: '1100px', height: '1100px', backgroundImage: `url(${overlayImage})`, backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: 'contain', opacity: overlayOpacity }} />
        ) : null}
      </div>
      <RouteTransition>{children}</RouteTransition>
      <footer style={{ width: '100%', background: '#232323', color: '#aaa', textAlign: 'center', padding: '32px 0 24px 0', marginTop: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 32 }}>
          <span>© {new Date().getFullYear()} Ronin Royale</span>
          <span>|</span>
          <a href="/privacy" style={{ color: '#aaa' }}>Privacy Policy</a>
          <span>|</span>
          <a href="/terms" style={{ color: '#aaa' }}>Terms of Service</a>
          <span>|</span>
          <span>Contact: info@roninroyale.com</span>
        </div>
      </footer>
    </>
  );
}


