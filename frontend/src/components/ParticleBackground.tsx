'use client';

import React, { useRef, useEffect } from 'react';

// Visual config
const GRADIENT_START = '#1f3a2b';
const GRADIENT_END = '#4a7a3f';
const NODE_COLOR = '#FFB300';
const LINE_COLOR = 'rgba(255,255,255,0.06)';

const NUM_NODES = 28;
const MAX_LINK_DISTANCE = 140;

// Shape overlay config
const NUM_SHAPES = 12; // number of polygon shapes to render
const SHAPE_SIDES = [5, 6, 8];

function randomBetween(a, b) {
  return Math.random() * (b - a) + a;
}

function drawRegularPolygon(ctx, x, y, radius, sides, rotation = 0) {
  if (sides < 3) return;
  const angle = (Math.PI * 2) / sides;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const px = x + radius * Math.cos(rotation + i * angle);
    const py = y + radius * Math.sin(rotation + i * angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

const ParticleBackground = () => {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const particlesRef = useRef([]);
  const shapesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initParticles() {
      const particles = [];
      for (let i = 0; i < NUM_NODES; i++) {
        particles.push({
          x: randomBetween(0, w),
          y: randomBetween(0, h),
          vx: randomBetween(-0.3, 0.3),
          vy: randomBetween(-0.2, 0.2),
          r: randomBetween(1.2, 3.2),
        });
      }
      particlesRef.current = particles;
    }

    function initShapes() {
      const shapes = [];
      for (let i = 0; i < NUM_SHAPES; i++) {
        const sides = SHAPE_SIDES[Math.floor(randomBetween(0, SHAPE_SIDES.length))];
        // stronger/bolder shapes (sizes slightly larger, higher opacity)
        const size = randomBetween(48, 140);
        shapes.push({
          x: randomBetween(0, w),
          y: randomBetween(0, h),
          vx: randomBetween(-0.12, 0.12),
          vy: randomBetween(-0.06, 0.06),
          size,
          sides,
          rotation: randomBetween(0, Math.PI * 2),
          rotateSpeed: randomBetween(-0.006, 0.006),
          // make them bolder (approx 3x stronger visually)
          opacity: Math.min(0.9, randomBetween(0.36, 0.6)),
        });
      }
      shapesRef.current = shapes;
    }

    function drawGradient() {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, GRADIENT_START);
      gradient.addColorStop(1, GRADIENT_END);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }

    function drawShapes() {
      const shapes = shapesRef.current;
      for (let i = 0; i < shapes.length; i++) {
        const s = shapes[i];
        ctx.save();
        ctx.globalAlpha = s.opacity;
        // stronger fill and stroke so shapes pop above background
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        // subtle glow/shadow to lift shape
        ctx.shadowColor = 'rgba(0,0,0,0.32)';
        ctx.shadowBlur = 12;
        drawRegularPolygon(ctx, s.x, s.y, s.size, s.sides, s.rotation);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    }

    function draw() {
      // Clear and background
      drawGradient();
      const particles = particlesRef.current;

      // draw links
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_LINK_DISTANCE) {
            const alpha = 1 - dist / MAX_LINK_DISTANCE;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255,255,255,${0.04 * alpha})`;
            ctx.lineWidth = 1 * Math.min(1, alpha);
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // draw nodes
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.fillStyle = NODE_COLOR;
        ctx.globalAlpha = 0.95;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Draw shape overlays on top so they pop above nodes
      drawShapes();
    }

    function step() {
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // wrap around
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
      }

      // update shapes
      const shapes = shapesRef.current;
      for (let i = 0; i < shapes.length; i++) {
        const s = shapes[i];
        s.x += s.vx;
        s.y += s.vy;
        s.rotation += s.rotateSpeed;
        // wrap
        if (s.x < -s.size) s.x = w + s.size;
        if (s.x > w + s.size) s.x = -s.size;
        if (s.y < -s.size) s.y = h + s.size;
        if (s.y > h + s.size) s.y = -s.size;
      }

      draw();
      rafRef.current = requestAnimationFrame(step);
    }

    function start() {
      resize();
      initParticles();
      initShapes();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(step);
    }

    function handleResize() {
      resize();
      // re-initialize positions proportionally
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        particles[i].x = Math.max(0, Math.min(w, particles[i].x));
        particles[i].y = Math.max(0, Math.min(h, particles[i].y));
      }
      const shapes = shapesRef.current;
      for (let i = 0; i < shapes.length; i++) {
        shapes[i].x = Math.max(0, Math.min(w, shapes[i].x));
        shapes[i].y = Math.max(0, Math.min(h, shapes[i].y));
      }
    }

    start();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        mixBlendMode: 'normal',
      }}
    />
  );
};

export default ParticleBackground;
