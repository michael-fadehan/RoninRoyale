"use client";

import ParticleBackground from '../components/ParticleBackground';
import { useState, useEffect, useRef } from 'react';
import { useAccount, useDisconnect, useEnsName } from 'wagmi';
import WalletSelectionModal from '../components/WalletSelectionModal';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

const faqs = [
  {
    question: 'Pellentesque ac bibendum tortor?',
    answer: 'Vivamus sit amet interdum elit. Proin lacinia erat ac velit tempus auctor.',
    open: true,
  },
  {
    question: 'In mi nulla, fringilla vestibulum?',
    answer: 'Sed cursus, urna at aliquam rhoncus, urna quam viverra nisi, in interdum massa nibh nec erat.',
    open: false,
  },
  {
    question: 'Quisque lacinia purus ut libero?',
    answer: 'Etiam euismod, urna eu tincidunt consectetur, nisi nisl aliquam enim, nec dictum urna.',
    open: false,
  },
  {
    question: 'Quisque ut metus sit amet augue?',
    answer: 'Morbi non lacus ac sapien dictum cursus. Pellentesque habitant morbi tristique senectus.',
    open: false,
  },
  {
    question: 'Pellentesque ac bibendum tortor?',
    answer: 'Vivamus sit amet interdum elit. Proin lacinia erat ac velit tempus auctor.',
    open: false,
  },
];

export default function Home() {
  const [openIdx, setOpenIdx] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const { data: ensName } = useEnsName({
    address,
    chainId: 1, // Only try ENS on Ethereum mainnet
    query: { enabled: false } // Disable ENS lookup for now since we're on Ronin
  });
  const { disconnect } = useDisconnect();

  function shortenAddress(addr?: string) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  useEffect(() => { setMounted(true); }, []);

  const slideItems = [
    { src: '/assets/dice.png', slug: 'dice' },
    { src: '/assets/aviator.png', slug: 'aviator' },
    { src: '/assets/bottle.png', slug: 'bottle' },
    { src: '/assets/coinflip.png', slug: 'coinflip' },
    { src: '/assets/fruit-punch.png', slug: 'fruit-punch' },
    { src: '/assets/higher.png', slug: 'higher' },
    { src: '/assets/lucky-spin.png', slug: 'lucky-spin' },
    { src: '/assets/rockets.png', slug: 'rockets' },
    { src: '/assets/roulette.png', slug: 'roulette' },
    { src: '/assets/treasure.png', slug: 'treasure' },
  ];

  const [activeSection, setActiveSection] = useState('home' as 'home'|'casino'|'quest');
  const homeRef = useRef(null as HTMLElement | null);
  const casinoRef = useRef(null as HTMLElement | null);
  const questRef = useRef(null as HTMLElement | null);

  useEffect(() => {
    const obsOpts = { root: null, rootMargin: '-30% 0px -50% 0px', threshold: 0 };
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const id = (e.target as HTMLElement).id;
        if (id === 'home' || id === 'casino' || id === 'quest') setActiveSection(id as any);
      });
    }, obsOpts);
    if (homeRef.current) obs.observe(homeRef.current);
    if (casinoRef.current) obs.observe(casinoRef.current);
    if (questRef.current) obs.observe(questRef.current);
    return () => obs.disconnect();
  }, []);

  function scrollToId(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          height: 100%;
        }
        body, #__next {
          min-height: 100vh;
          height: 100%;
        }
        main {
          margin: 0;
          padding: 0;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .content {
          flex: 1 0 auto;
        }
        .quest-section {
          /* match casino section width/margins */
          width: calc(100% - 64px);
          margin: 48px 32px 0 32px;
          max-width: none;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }
        .quest-card {
          background: #393939cc; /* 70% opacity */
          /* border-radius: 20px; */
          border-radius: 0;
          box-shadow: 0 4px 32px rgba(0,0,0,0.10);
          color: #fff;
          padding: 64px 48px 48px 48px;
          width: 100%;
          position: relative;
          min-height: 340px;
          display: flex;
          flex-direction: column;
          max-width: 1200px;
        }
        .quest-title {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 32px;
        }
        .quest-subtitle {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 32px;
        }
        .quest-desc {
          font-size: 1.1rem;
          color: #e0e0e0;
          margin-bottom: 64px;
        }
        .quest-actions {
          position: absolute;
          right: 32px;
          bottom: 32px;
          display: flex;
          gap: 18px;
        }
        .quest-btn {
          background: #FFB300;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 10px 28px;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          transition: background 0.2s;
        }
        .quest-btn.go {
          padding: 10px 18px;
        }
        .quest-btn:hover {
          background: #e09c00;
        }
        .faq-section-wrapper {
          display: flex;
          justify-content: center;
          margin-top: 32px;
          margin-bottom: 56px;
          position: relative; /* allow overlay */
        }
        .faq-section {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          gap: 64px;
          background: #232323cc; /* 80% opacity */
          border-radius: 0 0 16px 16px;
          max-width: 1200px;
          width: 100%;
          padding: 64px 48px 64px 48px;
          box-shadow: 0 4px 32px rgba(0,0,0,0.10);
          position: relative;
          z-index: 2; /* sit above the left overlay */
        }

        /* Left-side large illustration overlay behind FAQ section */
        .faq-section-wrapper::before {
          content: '';
          position: absolute;
          left: -8%;
          top: -8%;
          width: 900px;
          height: 900px;
          background-image: url('/assets/section-illustration2.svg');
          background-position: left top;
          background-repeat: no-repeat;
          background-size: contain;
          opacity: 0.56; /* increased to make it pop ~2x */
          pointer-events: none;
          z-index: 1;
          transform: translateZ(0) scale(1.12);
          filter: drop-shadow(-18px 36px 72px rgba(0,0,0,0.36));
        }
        .faq-left {
          flex: 1;
          color: #fff;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .faq-title {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .faq-desc {
          font-size: 1.1rem;
          color: #ccc;
        }
        .faq-img {
          width: 220px;
          margin-top: 24px;
        }
        .faq-right {
          flex: 1.2;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .faq-accordion {
          background: #323232;
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.10);
          color: #fff;
          overflow: hidden;
        }
        .faq-question {
          padding: 20px 24px;
          font-size: 1.1rem;
          font-weight: 600;
          background: #388E3C;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .faq-question.closed {
          background: #323232;
          color: #fff;
        }
        .faq-answer {
          padding: 18px 24px 20px 24px;
          font-size: 1rem;
          color: #ccc;
          background: #323232;
        }
        .faq-chevron {
          font-size: 1.5rem;
          transition: transform 0.2s;
        }
        .faq-chevron.open {
          transform: rotate(180deg);
        }
        footer {
          width: 100vw;
          background: #232323;
          color: #aaa;
          text-align: center;
          padding: 32px 0 24px 0;
          font-size: 1rem;
          margin-top: auto;
        }
        /* Hero Section */
        .hero-section {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          /* darker green gradient that becomes transparent toward the bottom to blend with page particle canvas */
          background: linear-gradient(120deg, rgba(19,58,27,0.98) 10%, rgba(38,82,36,0.96) 50%, rgba(38,82,36,0.65) 72%, rgba(38,82,36,0) 100%);
          min-height: 420px;
          padding: 80px 0 0 0;
          position: relative;
          overflow: visible;
        }
        .hero-section::before {
          /* subtle particle-like soft dots overlay (pure CSS) */
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 10% 20%, rgba(255,179,0,0.10), transparent 6%),
            radial-gradient(circle at 80% 25%, rgba(255,179,0,0.08), transparent 5%),
            radial-gradient(circle at 50% 70%, rgba(255,179,0,0.06), transparent 8%);
          pointer-events: none;
          mix-blend-mode: overlay;
          z-index: 0;
          transform: translateZ(0);
          animation: heroDrift 18s linear infinite;
        }
        .hero-section::after {
          /* gradient fade that blends the hero into the site's particle canvas at the bottom */
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 240px;
          /* mostly transparent at edges, slight dark band in the middle to keep contrast */
          background: linear-gradient(to bottom, rgba(38,82,36,0) 0%, rgba(18,34,22,0.18) 40%, rgba(18,34,22,0.36) 65%, rgba(18,34,22,0) 100%);
          pointer-events: none;
          z-index: 0;
          mix-blend-mode: multiply;
          opacity: 0.95;
        }
        @keyframes heroDrift {
          0% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(6px) translateX(-4px); }
          100% { transform: translateY(0) translateX(0); }
        }
        .hero-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1200px;
          width: 100%;
          gap: 32px;
          position: relative; /* keep content above overlays */
          z-index: 2;
        }
        .hero-left {
          flex: 1.2;
          color: #fff;
        }
        .hero-title {
          font-size: 4.5rem; /* 3rem * 1.5 */
          font-weight: 800;
          margin-bottom: 12px;
          white-space: nowrap; /* keep title on single line */
          display: inline-block;
          line-height: 1;
        }
        .hero-subtitle {
          font-size: 1.875rem; /* 1.25rem * 1.5 */
          font-weight: 600;
          margin-bottom: 18px;
        }
        .hero-desc {
          font-size: 1.65rem; /* 1.1rem * 1.5 */
          color: #e0e0e0;
          margin-bottom: 32px;
        }
        .hero-actions {
          display: flex;
          gap: 16px;
        }
        .hero-btn {
          font-weight: 700;
          font-size: 1rem;
          border-radius: 8px;
          padding: 12px 28px;
          border: none;
          cursor: pointer;
          transition: background 0.2s;
        }
        .hero-btn.primary {
          background: #FFA000; /* updated to requested color */
          color: #fff;
        }
        .hero-btn.secondary {
          background: transparent;
          color: #fff;
          border: 2px solid rgba(255,255,255,0.12);
        }
        .hero-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          position: relative;
          z-index: 2;
        }
        .hero-illustration {
          /* use user-provided hero illustration and make it pop with drop-shadow */
          width: 800px;
          height: 530px;
          background: url('/assets/hero-illustration-2.svg') center center / contain no-repeat;
          border-radius: 24px;
          /* use filter drop-shadow for softer blending with background */
          filter: drop-shadow(0 40px 60px rgba(0,0,0,0.55)) drop-shadow(0 10px 20px rgba(0,0,0,0.25));
          transform: translateY(-12px);
          z-index: 3; /* lift above subtle overlays */
        }
        /* Casino Cards Section */
        .casino-section {
          /* slightly reduced from header width to give more breathing room */
          width: calc(100% - 96px);
          margin: 56px 48px 0 48px;
          max-width: none;
          min-height: 600px; /* slightly reduced height */
          position: relative; /* allow overlay positioning */
        }
        .casino-section::after {
          content: '';
          position: absolute;
          /* drop further into bottom-right corner */
          right: -6%;
          bottom: -60px;
          /* make bigger */
          width: 1100px;
          height: 1100px;
          background-image: url('/assets/section-illustration.svg');
          background-position: center;
          background-repeat: no-repeat;
          background-size: contain;
          /* pop ~2x more */
          opacity: 0.24;
          pointer-events: none;
          z-index: 0; /* behind carousel content */
          transform: translateZ(0) scale(1.05);
          filter: drop-shadow(-8px 24px 40px rgba(0,0,0,0.18));
        }
        .casino-title {
          color: #fff;
          font-size: 2.25rem;
          font-weight: 700;
          margin-bottom: 24px;
          text-align: center; /* center heading */
        }
        /* nav active state */
        .nav-link { text-decoration: none; color: #ffffff; padding: 6px 10px; border-radius: 6px; font-weight: 700 }
        .nav-link.active { background: rgba(255,255,255,0.18); color: #ffffff }
        .nav-link:hover { background: rgba(255,255,255,0.16); color: #ffffff }
        .swiper-pagination { bottom: 18px !important; }
        .casino-swiper-wrapper {
          position: relative;
          z-index: 2;
          min-height: 520px;
          padding-bottom: 40px; /* reserve space for pagination */
        }
        .swiper {
          width: 100%;
          padding-bottom: 40px;
          min-height: 520px;
        }
        .swiper-slide {
          display: flex;
          justify-content: center;
          align-items: stretch;
          padding: 0; /* tightly packed slides */
          transition: transform 0.35s cubic-bezier(.2,1,.3,1), box-shadow 0.35s cubic-bezier(.2,1,.3,1);
          z-index: 1;
        }
        .swiper-wrapper {
          align-items: center;
        }
        .casino-card {
          background: #424242;
          border-radius: 16px;
          box-shadow: 0 6px 14px rgba(0,0,0,0.10);
          overflow: hidden;
          color: #fff;
          padding: 8px;
          flex: 0 0 auto;
          width: clamp(110px, 12vw, 220px);
          height: clamp(160px, 28vh, 380px);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          margin: 2px;
          transition: transform 0.35s cubic-bezier(.2,1,.3,1), box-shadow 0.35s cubic-bezier(.2,1,.3,1);
        }
        /* active card pops larger */
        .swiper-slide-active .casino-card {
          transform: scale(1.22) translateY(-22px);
          box-shadow: 0 30px 80px rgba(0,0,0,0.38), 0 10px 36px rgba(0,0,0,0.28);
          z-index: 30;
        }
        /* de-emphasize non-active cards slightly */
        .swiper-slide:not(.swiper-slide-active) .casino-card {
          transform: scale(0.94) translateY(0);
          opacity: 0.9;
          box-shadow: 0 6px 20px rgba(0,0,0,0.12);
          z-index: 10;
        }
        .casino-card-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin-bottom: 18px;
        }
        .casino-card-subtitle {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 18px;
        }
        .casino-card-desc {
          font-size: 1rem;
          color: #e0e0e0;
          margin-bottom: 32px;
        }
        /* casino-card-icon removed per request */
        .casino-card-actions {
          display: flex;
          gap: 12px;
          margin-top: auto;
        }

        /* first card image styles */
        .casino-card.image-card {
          background: transparent; /* remove grey background under image */
          padding: 0;
        }
        .casino-card.image-card .image-link {
          display: block;
          position: relative;
          width: 100%;
          height: 100%;
          text-decoration: none;
          color: inherit;
        }
        .casino-card.image-card img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .casino-card.image-card .play-now {
          position: absolute;
          bottom: 36px; /* dropped lower into the circled area */
          left: 50%;
          transform: translateX(-50%);
          z-index: 6;
          background: transparent; /* transparent background as requested */
          color: #fff;
          padding: 12px 28px;
          border-radius: 999px; /* pill */
          border: 2px solid rgba(255,255,255,0.95); /* white border thickness 2 */
          font-weight: 800;
          font-size: 1rem;
          cursor: pointer;
          box-shadow: 0 14px 30px rgba(0,0,0,0.45), 0 0 30px rgba(255,255,255,0.06);
          transition: transform 180ms ease, box-shadow 180ms ease;
          animation: popPulse 2400ms infinite ease-in-out;
          text-align: center;
        }
        .casino-card.image-card .play-now:focus { outline: none; }
        .casino-card.image-card .play-now:hover {
          transform: translateX(-50%) translateY(-6px) scale(1.03);
          box-shadow: 0 20px 40px rgba(0,0,0,0.55), 0 0 36px rgba(255,179,0,0.18);
        }
        /* card hover */
        .casino-card:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 30px 60px rgba(0,0,0,0.5); }
        @keyframes popPulse {
          0% { transform: translateX(-50%) translateY(0) scale(1); }
          50% { transform: translateX(-50%) translateY(-4px) scale(1.02); }
          100% { transform: translateX(-50%) translateY(0) scale(1); }
        }
        .casino-btn {
          background: #FFB300;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 10px 18px;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          transition: background 0.2s;
        }
        .casino-btn.go {
          padding: 10px 14px;
        }
        .casino-btn:hover {
          background: #e09c00;
        }
        .casino-scroll-indicator {
          width: 8px;
          height: 180px;
          margin-left: 12px;
          background: rgba(255,255,255,0.08);
          border-radius: 6px;
          display: flex;
          align-items: flex-start;
          position: relative;
          top: 16px;
        }
        .casino-scroll-bar {
          width: 100%;
          height: 48px;
          background: linear-gradient(180deg, #FFB300 0%, #FFD54F 100%);
          border-radius: 6px;
          transition: all 0.2s;
        }
        .swiper-pagination {
          position: absolute;
          left: 0;
          right: 0;
          bottom: -16px; /* moved much closer to cards */
          margin: 0 auto;
          text-align: center;
          z-index: 50;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 6px;
          pointer-events: none; /* let clicks pass through except bullets */
        }
        .swiper-pagination-bullet {
          background: #fff;
          opacity: 0.3;
          width: 12px;
          height: 12px;
          margin: 0 4px !important;
          pointer-events: auto;
        }
        .swiper-pagination-bullet-active {
          background: #FFB300;
          opacity: 1;
        }
        /* subtle hex overlays behind cards */
        .casino-section::before {
          content: '';
          position: absolute;
          top: 60px;
          left: 0;
          right: 0;
          height: 240px;
          /* overlay image disabled */
          /* background-image: url('/assets/overlay-1.png');
          background-position: center;
          background-repeat: no-repeat;
          background-size: contain;
          opacity: 0.14; */
          pointer-events: none;
          z-index: 0;
        }
        .casino-swiper-wrapper {
          position: relative;
          z-index: 2;
          overflow: visible; /* allow active card to pop out */
        }
      `}</style>
      <main style={{ minHeight: '100vh', width: '100vw', position: 'relative', overflow: 'hidden', margin: 0, padding: 0, paddingTop: 72, display: 'flex', flexDirection: 'column' }}>
        <ParticleBackground />
        <header
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            width: '100%',
            height: '72px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#000000',
            padding: '0 32px',
            margin: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* Logo and left nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <img src="/assets/Logo.png" alt="Logo" style={{ width: 58, height: 58 }} />
            {/* Nav links with separators */}
            <nav style={{ display: 'flex', alignItems: 'center' }}>
              <a href="#home" onClick={(e) => { e.preventDefault(); scrollToId('home'); }} className={`nav-link ${activeSection === 'home' ? 'active' : ''}`}>Home</a>
              <span style={{ width: 1, height: 24, background: '#666', margin: '0 12px' }} />
              <a href="/staking" className="nav-link">Staking</a>
              <span style={{ width: 1, height: 24, background: '#666', margin: '0 12px' }} />
              <a href="#quest" onClick={(e) => { e.preventDefault(); scrollToId('quest'); }} className={`nav-link ${activeSection === 'quest' ? 'active' : ''}`}>Quest</a>
              <span style={{ width: 1, height: 24, background: '#666', margin: '0 12px' }} />
              <a href="#casino" onClick={(e) => { e.preventDefault(); scrollToId('casino'); }} className={`nav-link ${activeSection === 'casino' ? 'active' : ''}`}>Casino</a>
            </nav>
          </div>
          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <nav style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <a href="#" style={{ color: '#fff', textDecoration: 'none', fontWeight: 600, letterSpacing: 1 }}>LEADERBOARD</a>
              <span style={{ width: 1, height: 24, background: '#666', margin: '0 8px' }} />
              <a href="#" style={{ color: '#fff', textDecoration: 'none', fontWeight: 600, letterSpacing: 1 }}>PROFILE</a>
            </nav>
            {mounted && isConnected ? (
              <button onClick={() => setWalletModalOpen(true)} style={{
                background: 'transparent',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6,
                padding: '8px 16px',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
              }}>
                {ensName ?? shortenAddress(address)}
              </button>
            ) : (
              <button onClick={() => setWalletModalOpen(true)} style={{
                background: '#FFB300',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 22px',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}>
                CONNECT WALLET
              </button>
            )}
          </div>
        </header>
        <div className="content">
          {/* Hero Section */}
          <section id="home" ref={homeRef} className="hero-section">
            <div className="hero-content">
              <div className="hero-left">
                <h1 className="hero-title">Ronin Royale</h1>
                <div className="hero-subtitle">Get Started - Play, Learn and Earn</div>
                <div className="hero-desc">Vestibulum faucibus eget erat eget pretium. Donec commodo convallis ligula, eget suscipit orci.</div>
                <div className="hero-actions">
                  <button className="hero-btn primary" onClick={() => setWalletModalOpen(true)}>GET STARTED</button>
                  <button className="hero-btn secondary" onClick={() => window.location.href = '/staking'}>STAKING</button>
                </div>
              </div>
              <div className="hero-right">
                {/* Placeholder for hero illustration */}
                <div className="hero-illustration" />
              </div>
            </div>
          </section>
          {/* Casino Cards Section */}
          <section id="casino" ref={casinoRef} className="casino-section">
            <h2 className="casino-title">Casino Games</h2>
            <div className="casino-swiper-wrapper">
              <Swiper
                modules={[Pagination]}
                spaceBetween={4}
                slidesPerView={'auto'}
                centeredSlides={true}
                initialSlide={Math.floor(slideItems.length / 2)}
                pagination={{ clickable: true }}
                direction="horizontal"
                breakpoints={{
                  480: { slidesPerView: 1.05, spaceBetween: 8 },
                  768: { slidesPerView: 2.2, spaceBetween: 10 },
                  1024: { slidesPerView: 4, spaceBetween: 12 },
                  1440: { slidesPerView: 6, spaceBetween: 14 },
                }}
                style={{ paddingBottom: 32, paddingTop: 60 }} >
                {slideItems.map((item, idx) => (
                  <SwiperSlide key={idx}>
                    <div className="casino-card image-card">
                      <a href={`/games/${item.slug}`} className="image-link" onClick={(e) => { /* allow navigation naturally */ }}>
                        <img src={item.src} alt={`slide-${idx + 1}`} />
                        <button className="play-now" onClick={(e) => { e.stopPropagation(); window.location.href = `/games/${item.slug}`; }}>PLAY NOW</button>
                      </a>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          </section>
          {/* Quest Card Section */}
          <section id="quest" ref={questRef} className="quest-section">
            <div className="quest-card">
              <div className="quest-title">Quest</div>
              <div className="quest-subtitle">Get Started - Play, Learn and Earn</div>
              <div className="quest-desc">
                Vestibulum faucibus eget erat eget pretium. Donec commodo convallis ligula, eget suscipit orci.
              </div>
              <div className="quest-actions">
                <button className="quest-btn connect" onClick={() => setWalletModalOpen(true)}>CONNECT WALLET</button>
                <button className="quest-btn go">GO</button>
              </div>
            </div>
          </section>
          {/* FAQ Section */}
          <section className="faq-section-wrapper">
            <div className="faq-section">
              <div className="faq-left">
                <div>
                  <div className="faq-title">Frequently Asked Questions</div>
                  <div className="faq-desc">Nam sollicitudin dignissim nunc, cursus ullamcorper.</div>
                </div>
                <img className="faq-img" src="/assets/faq-illustration.png" alt="FAQ Illustration" />
              </div>
              <div className="faq-right">
                {faqs.map((faq, idx) => (
                  <div className="faq-accordion" key={idx}>
                    <div
                      className={`faq-question${openIdx === idx ? '' : ' closed'}`}
                      onClick={() => setOpenIdx(openIdx === idx ? -1 : idx)}
                      style={openIdx === idx ? { background: '#388E3C', color: '#fff' } : {}}
                    >
                      {faq.question}
                      <span className={`faq-chevron${openIdx === idx ? ' open' : ''}`}>▼</span>
                    </div>
                    {openIdx === idx && (
                      <div className="faq-answer">{faq.answer}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
        <footer>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 32 }}>
            <span>© {new Date().getFullYear()} Ronin Royale</span>
            <span>|</span>
            <span>Privacy Policy</span>
            <span>|</span>
            <span>Terms of Service</span>
            <span>|</span>
            <span>Contact: info@roninroyale.com</span>
          </div>
        </footer>
        <WalletSelectionModal
          open={walletModalOpen}
          onClose={() => setWalletModalOpen(false)}
        />
      </main>
    </>
  );
}
