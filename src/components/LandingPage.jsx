import React from 'react';

export default function LandingPage({ onLaunch }) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white font-sans">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 scale-105 animate-slow-zoom"
        style={{
          backgroundImage: 'url("/space-whale.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.6)'
        }}
      />

      {/* Decorative Grid/Lines */}
      <div className="absolute inset-0 z-10">
        <div className="h-full w-[80px] border-r border-white/20 md:w-[120px]" />
      </div>

      {/* Content Container */}
      <div className="relative z-20 flex h-full flex-col justify-end">
        <div className="pl-[80px] pb-24 md:pl-[120px] lg:pb-32">
          <div className="max-w-5xl px-8 md:px-16">
            <h1 className="text-8xl font-bold tracking-tight md:text-[160px] leading-[0.85]">
              OceanGuard
            </h1>
            <p className="mt-4 text-6xl font-serif italic tracking-tight text-white md:text-[100px] leading-[0.9]">
              Saving Whale Lives
            </p>
            <p className="mt-6 text-xl font-medium tracking-[0.2em] uppercase text-teal-400 opacity-80 md:text-2xl">
              through data visualization
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/20 bg-black/60 backdrop-blur-xl">
          <div className="flex h-full flex-col md:flex-row">
            {/* Project Summary */}
            <div className="flex-[2] border-r border-white/20 px-8 py-10 md:px-16 md:pl-[120px]">
              <p className="max-w-xl text-sm leading-relaxed text-zinc-300">
                OceanGuard is a high-fidelity data ecosystem dedicated to monitoring whale migration paths 
                and mitigating maritime risks. By synthesizing global shipping lanes and contamination zones, 
                we empower conservationists with real-time, agentic intelligence to protect our oceans' 
                most majestic inhabitants.
              </p>
            </div>

            {/* Action / Status */}
            <div className="flex flex-1 items-center justify-between px-8 py-10 md:px-12">
              <div className="text-xs leading-tight text-zinc-400">
                <span className="block font-bold text-white uppercase tracking-wider mb-1">Global Initiative</span>
                Mapping 5 major gyres and <br/> live traffic corridors.
              </div>
              
              <button 
                onClick={onLaunch}
                className="group relative flex h-16 w-16 items-center justify-center rounded-full border border-white/40 transition-all hover:bg-white hover:text-black hover:scale-110"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14m-7-7 7 7-7 7"/>
                </svg>
                {/* Tooltip-like label */}
                <span className="absolute -top-10 scale-0 font-bold uppercase tracking-widest text-[10px] transition-all group-hover:scale-100">
                  Launch
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slow-zoom {
          from { transform: scale(1); }
          to { transform: scale(1.15); }
        }
        .animate-slow-zoom {
          animation: slow-zoom 25s infinite alternate ease-in-out;
        }
      `}</style>
    </div>
  );
}
