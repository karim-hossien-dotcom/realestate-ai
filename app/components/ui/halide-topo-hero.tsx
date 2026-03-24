"use client";

import React, { useEffect, useRef } from 'react';

interface HalideTopoHeroProps {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  onCtaClick?: () => void;
  className?: string;
}

export function HalideTopoHero({
  title = 'ESTATE\nAI',
  subtitle = 'AI-POWERED OUTREACH FOR COMMERCIAL REAL ESTATE',
  ctaText = 'GET STARTED',
  onCtaClick,
  className,
}: HalideTopoHeroProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = (window.innerWidth / 2 - e.pageX) / 25;
      const y = (window.innerHeight / 2 - e.pageY) / 25;
      canvas.style.transform = `rotateX(${55 + y / 2}deg) rotateZ(${-25 + x / 2}deg)`;
      layersRef.current.forEach((layer, index) => {
        if (!layer) return;
        const depth = (index + 1) * 15;
        const moveX = x * (index + 1) * 0.2;
        const moveY = y * (index + 1) * 0.2;
        layer.style.transform = `translateZ(${depth}px) translate(${moveX}px, ${moveY}px)`;
      });
    };

    canvas.style.opacity = '0';
    canvas.style.transform = 'rotateX(90deg) rotateZ(0deg) scale(0.8)';
    const timeout = setTimeout(() => {
      canvas.style.transition = 'all 2.5s cubic-bezier(0.16, 1, 0.3, 1)';
      canvas.style.opacity = '1';
      canvas.style.transform = 'rotateX(55deg) rotateZ(-25deg) scale(1)';
    }, 300);

    window.addEventListener('mousemove', handleMouseMove);
    return () => { window.removeEventListener('mousemove', handleMouseMove); clearTimeout(timeout); };
  }, []);

  return (
    <div className={`relative bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden h-screen w-full flex items-center justify-center ${className || ''}`}
      style={{ fontFamily: "'Syncopate', sans-serif" }}>

      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" /><feColorMatrix type="saturate" values="0" /></filter>
      </svg>
      <div className="fixed inset-0 pointer-events-none z-[100] opacity-15" style={{ filter: 'url(#grain)' }} />

      {/* Interface Grid */}
      <div className="fixed inset-0 p-16 grid grid-cols-2 grid-rows-[auto_1fr_auto] z-10 pointer-events-none">
        <div className="font-bold text-sm">ESTATE_AI</div>
        <div className="text-right font-mono text-[#ff3c00] text-[0.7rem]">
          <div>AI-POWERED CRM</div>
          <div>COMMERCIAL RE</div>
        </div>
        <h1 className="col-span-2 self-center text-[clamp(3rem,10vw,10rem)] leading-[0.85] tracking-[-0.04em]" style={{ mixBlendMode: 'difference' }}>
          {title.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
        </h1>
        <div className="col-span-2 flex justify-between items-end">
          <div className="font-mono text-xs">
            <p>[ LAUNCHED 2026 ]</p>
            <p>{subtitle}</p>
          </div>
          <button onClick={onCtaClick} className="pointer-events-auto bg-[#e0e0e0] text-[#0a0a0a] px-8 py-4 font-bold no-underline transition-all duration-300 hover:bg-[#ff3c00] hover:-translate-y-1 cursor-pointer"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 85% 100%, 0 100%)' }}>
            {ctaText}
          </button>
        </div>
      </div>

      {/* 3D Viewport */}
      <div className="flex items-center justify-center w-full h-full" style={{ perspective: '2000px' }}>
        <div ref={canvasRef} className="relative w-[800px] h-[500px]" style={{ transformStyle: 'preserve-3d', transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <div ref={el => { if (el) layersRef.current[0] = el; }} className="absolute inset-0 border border-white/10 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1200')", filter: 'grayscale(1) contrast(1.2) brightness(0.5)' }} />
          <div ref={el => { if (el) layersRef.current[1] = el; }} className="absolute inset-0 border border-white/10 bg-cover bg-center opacity-60" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=1200')", filter: 'grayscale(1) contrast(1.1) brightness(0.7)', mixBlendMode: 'screen' }} />
          <div ref={el => { if (el) layersRef.current[2] = el; }} className="absolute inset-0 border border-white/10 bg-cover bg-center opacity-40" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&q=80&w=1200')", filter: 'grayscale(1) contrast(1.3) brightness(0.8)', mixBlendMode: 'overlay' }} />
          <div className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] pointer-events-none" style={{ backgroundImage: 'repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 40px, rgba(255,255,255,0.05) 41px, transparent 42px)', transform: 'translateZ(120px)' }} />
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 w-px h-[60px]" style={{ background: 'linear-gradient(to bottom, #e0e0e0, transparent)', animation: 'flow 2s infinite ease-in-out' }} />

      <style>{`@keyframes flow { 0%, 100% { transform: scaleY(0); transform-origin: top; } 50% { transform: scaleY(1); transform-origin: top; } 51% { transform: scaleY(1); transform-origin: bottom; } }`}</style>
    </div>
  );
}
