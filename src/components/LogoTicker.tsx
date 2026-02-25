'use client';

const svgLogos: Record<string, { path: string, viewBox: string }> = {};

const lanes = {
  Podcasts: [
    { type: 'text', value: 'BOMBING WITH ERIC ANDRE' },
    { type: 'text', value: 'BABY, THIS IS KEKE PALMER' },
    { type: 'text', value: 'NEW HEIGHTS' },
    { type: 'text', value: 'GOOD FORTUNE' }
  ],
  Performance: [
    { type: 'text', value: 'TONY AWARDS' },
    { type: 'text', value: 'MOULIN ROUGE!' },
    { type: 'text', value: 'MERRILY WE ROLL ALONG' },
    { type: 'text', value: 'THE GREAT GATSBY' },
    { type: 'text', value: 'SMASH' },
    { type: 'text', value: 'GUTENBERG!' },
    { type: 'text', value: 'ONCE UPON A MATTRESS' },
    { type: 'text', value: 'THE QUEEN OF VERSAILLES' },
    { type: 'text', value: 'McNEAL' },
    { type: 'text', value: 'MACBETH' },
    { type: 'text', value: 'LEMPICKA' },
    { type: 'text', value: 'REAL WOMEN HAVE CURVES' },
    { type: 'text', value: 'THE SIGN IN SIDNEY BRUSTEIN’S WINDOW' },
    { type: 'text', value: 'CHESS' },
    { type: 'text', value: 'DEAD OUTLAW' },
    { type: 'text', value: 'PHANTOM OF THE OPERA' },
    { type: 'text', value: 'TAKE ME OUT' },
    { type: 'text', value: 'DRAG: THE MUSICAL' },
    { type: 'text', value: 'FLOYD COLLINS' },
    { type: 'text', value: 'WALDEN' },
    { type: 'text', value: 'CULT OF LOVE' },
    { type: 'text', value: 'SHAKESPEARE THEATRE NJ' },
    { type: 'text', value: 'ARS NOVA' }
  ],
  Brand: [
    { type: 'text', value: 'HULU' },
    { type: 'text', value: 'QUALCOMM' },
    { type: 'text', value: 'GOOD MORNING AMERICA' },
    { type: 'text', value: 'UNIVISION' },
    { type: 'text', value: 'T-MOBILE' },
    { type: 'text', value: 'VISIBLE' },
    { type: 'text', value: 'YMCA' },
    { type: 'text', value: 'HEINEKEN' },
    { type: 'text', value: 'AMERICAN CANCER SOCIETY' }
  ]
};

interface TickerItem {
  type: string;
  value: string;
}

const TickerLane = ({ title, items, scrollClass = "animate-scroll-slow" }: { title: string, items: TickerItem[], scrollClass?: string }) => (
  <div className="flex flex-col md:flex-row gap-8 md:items-center border-b border-white/10 pb-8 overflow-hidden">
    <h3 className="w-full md:w-40 text-xs md:text-sm font-bold tracking-[0.3em] uppercase text-white/40 shrink-0 mb-4 md:mb-0">{title}</h3>
    
    <div className="flex-1 overflow-hidden relative" style={{ maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' }}>
      <div 
        className={`flex w-max ${scrollClass} items-center pointer-events-none`}
        style={{ willChange: 'transform', transform: 'translate3d(0,0,0)', WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}
      >
        {/* Render 4 Sets to ensure marquee never runs out of text on wide screens or short lists */}
        {[...Array(4)].map((_, setIndex) => (
          <div key={`set-${setIndex}`} className="flex gap-16 items-center pr-16 shrink-0" style={{ WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}>
            {items.map((item, i) => (
              <span key={`${setIndex}-${i}`} className="text-xl md:text-2xl font-black tracking-tighter opacity-60 cursor-default flex-shrink-0" style={{ transform: 'translateZ(0)', WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}>
                {item.value}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default function LogoTicker() {
  return (
    <div className="w-full space-y-8">
      <TickerLane title="Brands" items={lanes.Brand} />
      <TickerLane title="Performance" items={lanes.Performance} scrollClass="animate-scroll-slower" />
      <TickerLane title="New Media" items={lanes.Podcasts} />
    </div>
  );
}
