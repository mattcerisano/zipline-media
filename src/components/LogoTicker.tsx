'use client';

const svgLogos = {
  Spotify: { path: 'M68.456,48.956c-7.81-4.674-17.743-7.231-28.012-7.231c-6.555,0-11.06,0.935-15.469,2.146. c-1.631,0.46-2.44,1.607-2.44,3.275c0,1.701,1.377,3.076,3.064,3.076c0.716,0,1.145-0.227,1.91-0.438. c3.548-0.945,7.837-1.641,12.803', viewBox: '0 0 100 100' }
};

const lanes = {
  Podcasts: [
    { type: 'text', value: 'BOMBING WITH ERIC ANDRE' },
    { type: 'text', value: 'BABY, THIS IS KEKE PALMER' },
    { type: 'text', value: 'NEW HEIGHTS' }
  ],
  Performance: [
    { type: 'text', value: 'TONY AWARDS' },
    { type: 'text', value: 'MOULIN ROUGE!' },
    { type: 'text', value: 'PHANTOM OF THE OPERA' },
    { type: 'text', value: '2ST' },
    { type: 'text', value: 'THE GREAT GATSBY' },
    { type: 'text', value: 'SHAKESPEARE THEATRE NJ' },
    { type: 'text', value: 'ARS NOVA' }
  ],
  Brand: [
    { type: 'text', value: 'QUALCOMM' },
    { type: 'text', value: 'GOOD MORNING AMERICA' },
    { type: 'text', value: 'UNIVISION' },
    { type: 'text', value: 'T-MOBILE' },
    { type: 'text', value: 'VISIBLE' },
    { type: 'text', value: 'THE BACHELOR' },
    { type: 'text', value: 'YMCA' },
    { type: 'text', value: 'MAC PRO' },
    { type: 'text', value: 'AMERICAN CANCER SOCIETY' },
    { type: 'text', value: 'HEINEKEN' },
    { type: 'text', value: 'LIVEX' }
  ]
};

interface TickerItem {
  type: string;
  value: string;
}

const TickerLane = ({ title, items }: { title: string, items: TickerItem[] }) => (
  <div className="flex flex-col md:flex-row gap-8 md:items-center border-b border-white/10 pb-8 overflow-hidden">
    <h3 className="w-32 text-[10px] font-bold tracking-[0.4em] uppercase text-white/40 shrink-0">{title}</h3>
    
    <div className="flex-1 overflow-hidden relative">
      <div className="flex w-fit animate-scroll whitespace-nowrap gap-16 items-center">
        {/* Original List */}
        {items.map((item, i) => (
          item.type === 'svg' ? (
            <svg key={i} viewBox={svgLogos[item.value as keyof typeof svgLogos].viewBox} className="h-8 w-auto fill-white opacity-40 hover:opacity-100 transition-opacity flex-shrink-0">
              <path d={svgLogos[item.value as keyof typeof svgLogos].path} />
            </svg>
          ) : (
            <span key={i} className="text-xl md:text-2xl font-black tracking-tighter opacity-60 hover:opacity-100 transition-opacity cursor-default flex-shrink-0">
              {item.value}
            </span>
          )
        ))}
        {/* Duplicate for Loop */}
        {items.map((item, i) => (
          item.type === 'svg' ? (
            <svg key={`dup-${i}`} viewBox={svgLogos[item.value as keyof typeof svgLogos].viewBox} className="h-8 w-auto fill-white opacity-40 hover:opacity-100 transition-opacity flex-shrink-0">
              <path d={svgLogos[item.value as keyof typeof svgLogos].path} />
            </svg>
          ) : (
            <span key={`dup-${i}`} className="text-xl md:text-2xl font-black tracking-tighter opacity-60 hover:opacity-100 transition-opacity cursor-default flex-shrink-0">
              {item.value}
            </span>
          )
        ))}
      </div>
    </div>
  </div>
);

export default function LogoTicker() {
  return (
    <section className="py-24 bg-black px-6 max-w-7xl mx-auto space-y-8">
      <div className="mb-12 text-center">
        <p className="text-sm md:text-lg font-medium tracking-[0.2em] uppercase opacity-50">
          High drama for Broadway. No drama for you.
        </p>
      </div>
      <TickerLane title="Brand" items={lanes.Brand} />
      <TickerLane title="Performance" items={lanes.Performance} />
      <TickerLane title="Podcasts" items={lanes.Podcasts} />
    </section>
  );
}
