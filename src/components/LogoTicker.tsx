'use client';

const svgLogos = {
  Chase: { path: 'M11.453 31.964c-0.161 0-0.313-0.026-0.438-0.089-0.13-0.057-0.255-0.135-0.375-0.229-0.115-0.094-0.198-0.208-0.245-0.349s-0.083-0.297-0.104-0.458l0.036-7.896h20.859l-9.479 9.021h-10.292zM32 20.547c-0.021 0.167-0.057 0.313-0.104 0.443-0.047 0.125-0.13 0.245-0.25 0.349-0.115 0.109', viewBox: '0 0 48 48' },
  Spotify: { path: 'M68.456,48.956c-7.81-4.674-17.743-7.231-28.012-7.231c-6.555,0-11.06,0.935-15.469,2.146. c-1.631,0.46-2.44,1.607-2.44,3.275c0,1.701,1.377,3.076,3.064,3.076c0.716,0,1.145-0.227,1.91-0.438. c3.548-0.945,7.837-1.641,12.803', viewBox: '0 0 100 100' },
  Nike: { path: 'M245.8075 717.62406c-29.79588-1.1837-54.1734-9.3368-73.23459-24.4796-3.63775-2.8928-12.30611-11.5663-15.21427-15.2245-7.72958-9.7193-12.98467-19.1785-16.48977-29.6734-10.7857-32.3061-5.23469-74.6989 15.87753-121.2243 18.0765-39.8316 45.96932-79.3366 94.63252-134.0508 7.16836-8.0511 28.51526-31.5969 28.65302-31.5969.051 0-1.11225 2.0153-2.57652 4.4694-12.65304 21.1938-23.47957 46.158-29.37751 67.7703-9.47448 34.6785-8.33163 64.4387 3.34693 87.5151 8.05611 15.898 21.86731 29.6684 37.3979 37.2806 27.18874 13.3214 66.9948 14.4235 115.60699 3.2245 3.34694-.7755 169.19363-44.801 368.55048-97.8366 199.35686-53.0408 362.49439-96.4029 362.51989-96.3672.056.046-463.16259 198.2599-703.62654', viewBox: '0 0 1000 1000' },
  Apple: { path: 'M349.13,136.86c-40.32,0-57.36,19.24-85.44,19.24C234.9,156.1,212.94,137,178,137c-34.2,0-70.67,20.88-93.83,56.45-32.52,50.16-27,144.63,25.67,225.11,18.84,28.81,44,61.12,77,61.47h.6c28.68,0,37.2-18.78,76.67-19h.6c38.88,0,46.68,18.89,75.24,18.89h.6c33', viewBox: '0 0 500 500' }
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
    { type: 'text', value: 'CHASE' },
    { type: 'text', value: 'NIKE' },
    { type: 'text', value: 'APPLE' },
    { type: 'text', value: 'THE BACHELOR' },
    { type: 'text', value: 'YMCA' },
    { type: 'text', value: 'MAC PRO' },
    { type: 'text', value: 'AMERICAN CANCER SOCIETY' },
    { type: 'text', value: 'HEINEKEN' }
  ]
};

const TickerLane = ({ title, items }: { title: string, items: any[] }) => (
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
