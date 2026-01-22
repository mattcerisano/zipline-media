'use client';

import { motion } from 'framer-motion';

export default function Archive() {
  // A comprehensive list of Zipline Media projects
  const archive = [
    { year: '2025', client: 'Cole Escola', project: 'Tony Awards First Impressions', type: 'Social' },
    { year: '2025', client: 'Zipline Media', project: 'Performance Reel', type: 'Reel' },
    { year: '2024', client: 'Daniel Radcliffe', project: 'Tony Awards First Impressions', type: 'Social' },
    { year: '2024', client: 'Baby, This is Keke Palmer', project: 'Season Highlights', type: 'Podcast' },
    { year: '2024', client: 'New Heights', project: 'Live Show Recap', type: 'Podcast' },
    { year: '2024', client: 'Bombing with Eric Andre', project: 'Launch Campaign', type: 'Podcast' },
    { year: '2024', client: 'The Great Gatsby', project: 'Official Trailer', type: 'Broadway' },
    { year: '2023', client: 'Jodie Comer', project: 'Tony Awards First Impressions', type: 'Social' },
    { year: '2023', client: 'Moulin Rouge!', project: 'Tantris Campaign', type: 'Broadway' },
    { year: '2023', client: 'Sweeney Todd', project: 'Opening Night Gala', type: 'Event' },
    { year: '2023', client: 'Shucked', project: 'Corn Kid Viral Spot', type: 'Social' },
    { year: '2023', client: 'Chase Bank', project: 'Sapphire Lounge Reveal', type: 'Corporate' },
    { year: '2022', client: 'Jesse Tyler Ferguson', project: 'Tony Awards First Impressions', type: 'Social' },
    { year: '2022', client: 'Phantom of the Opera', project: '35th Anniversary Tribute', type: 'Legacy' },
    { year: '2022', client: 'T-Mobile', project: 'Un-carrier Event', type: 'Corporate' },
    { year: '2022', client: 'The Bachelor', project: 'Finale Red Carpet', type: 'Broadcast' },
    { year: '2021', client: 'Visible Mobile', project: 'Blue Holiday', type: 'Commercial' },
    { year: '2021', client: 'American Cancer Society', project: 'Hope Gala', type: 'Non-Profit' },
    { year: '2021', client: 'Nike', project: 'Air Max Day NYC', type: 'Event' },
    { year: '2020', client: 'Hamilton', project: 'Disney+ Release Promo', type: 'Broadcast' },
  ];

  return (
    <div className="bg-black min-h-screen text-white pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-20">
          <h1 className="text-[10vw] font-black tracking-tighter leading-none text-neutral-800 select-none">
            ZIPLINE VIDEO REPOSITORY
          </h1>
          <p className="text-xl font-medium mt-4 ml-2 opacity-60">
            The full repository. Every frame, every client, every year.
          </p>
        </div>

        <div className="border-t border-white/20">
          <div className="grid grid-cols-12 gap-4 py-4 border-b border-white/20 text-[10px] uppercase tracking-[0.3em] font-bold opacity-40">
            <div className="col-span-2 md:col-span-1">Year</div>
            <div className="col-span-4 md:col-span-3">Client</div>
            <div className="col-span-6 md:col-span-6">Project</div>
            <div className="hidden md:block md:col-span-2 text-right">Type</div>
          </div>

          {archive.map((item, index) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05, duration: 0.5 }}
              key={index}
              className="grid grid-cols-12 gap-4 py-6 border-b border-white/10 hover:bg-white/5 transition-colors cursor-pointer group items-center"
            >
              <div className="col-span-2 md:col-span-1 text-sm font-bold opacity-60 group-hover:opacity-100 group-hover:text-blue-500 transition-all">
                {item.year}
              </div>
              <div className="col-span-4 md:col-span-3 text-lg md:text-xl font-black uppercase tracking-tight">
                {item.client}
              </div>
              <div className="col-span-6 md:col-span-6 text-sm md:text-lg font-medium opacity-80 group-hover:opacity-100">
                {item.project}
              </div>
              <div className="hidden md:block md:col-span-2 text-right text-xs uppercase tracking-widest opacity-40 group-hover:opacity-100">
                {item.type}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <p className="text-neutral-500 text-sm">End of file.</p>
        </div>
      </div>
    </div>
  );
}
