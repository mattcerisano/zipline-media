'use client';

import { motion } from 'framer-motion';
import { Play, Youtube, Link as LinkIcon } from 'lucide-react';

const archive = [
  { 
    id: 1,
    year: '2025', 
    client: 'Cole Escola', 
    project: 'Sarah Snook | 2025 Tony Awards First Impressions', 
    type: 'Social',
    image: 'https://images.unsplash.com/photo-1514302240736-b1fee5989461?q=80&w=800&auto=format&fit=crop',
    youtube: 'https://www.youtube.com/watch?v=1RW3OCUMp4s',
    vimeo: '#'
  },
  { 
    id: 2,
    year: '2025', 
    client: 'Zipline Media', 
    project: 'Performance Reel', 
    type: 'Reel',
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 3,
    year: '2024', 
    client: 'Daniel Radcliffe', 
    project: 'Merrily We Roll Along', 
    type: 'Social',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 4,
    year: '2024', 
    client: 'Keke Palmer', 
    project: 'Baby, This is Keke Palmer', 
    type: 'Podcast',
    image: 'https://images.unsplash.com/photo-1619983081563-430f63602796?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 5,
    year: '2024', 
    client: 'New Heights', 
    project: 'Live Show Recap', 
    type: 'Podcast',
    image: 'https://images.unsplash.com/photo-1593697821252-0c9137d9fc45?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 6,
    year: '2024', 
    client: 'Eric Andre', 
    project: 'Bombing Launch Campaign', 
    type: 'Podcast',
    image: 'https://images.unsplash.com/photo-1516280440614-6697288d5d38?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 7,
    year: '2024', 
    client: 'The Great Gatsby', 
    project: 'Official Broadway Trailer', 
    type: 'Broadway',
    image: 'https://images.unsplash.com/photo-1507676184212-d03dec424719?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 8,
    year: '2023', 
    client: 'Jodie Comer', 
    project: 'Prima Facie', 
    type: 'Social',
    image: 'https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 9,
    year: '2023', 
    client: 'Moulin Rouge!', 
    project: 'Tantris Campaign', 
    type: 'Broadway',
    image: 'https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 10,
    year: '2023', 
    client: 'Sweeney Todd', 
    project: 'Opening Night Gala', 
    type: 'Event',
    image: 'https://images.unsplash.com/photo-1514525253440-b393452e3383?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 11,
    year: '2023', 
    client: 'Shucked', 
    project: 'Corn Kid Viral Spot', 
    type: 'Social',
    image: 'https://images.unsplash.com/photo-1621619856624-42fd193a0661?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 13,
    year: '2022', 
    client: 'Jesse Tyler Ferguson', 
    project: 'Take Me Out', 
    type: 'Social',
    image: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 14,
    year: '2022', 
    client: 'Phantom of the Opera', 
    project: '35th Anniversary Tribute', 
    type: 'Legacy',
    image: 'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 15,
    year: '2022', 
    client: 'T-Mobile', 
    project: 'Un-carrier Event', 
    type: 'Corporate',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 16,
    year: '2022', 
    client: 'The Bachelor', 
    project: 'Finale Red Carpet', 
    type: 'Broadcast',
    image: 'https://images.unsplash.com/photo-1574155376612-bfaeb5853465?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 17,
    year: '2021', 
    client: 'Visible Mobile', 
    project: 'Blue Holiday', 
    type: 'Commercial',
    image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 18,
    year: '2021', 
    client: 'American Cancer Society', 
    project: 'Hope Gala', 
    type: 'Non-Profit',
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
  { 
    id: 20,
    year: '2020', 
    client: 'Hamilton', 
    project: 'Disney+ Release Promo', 
    type: 'Broadcast',
    image: 'https://images.unsplash.com/photo-1507914372368-b2b003618950?q=80&w=800&auto=format&fit=crop',
    vimeo: '#'
  },
];

export default function Archive() {
  return (
    <div className="bg-black min-h-screen text-white pt-32 pb-20 px-4 md:px-6">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Header */}
        <div className="mb-16 md:mb-24">
          <h1 className="text-4xl md:text-[8vw] font-black tracking-tighter leading-none text-white/90 select-none mb-4 md:mb-8">
            VIDEO REPOSITORY
          </h1>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {archive.map((item, index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05, duration: 0.5 }}
              key={item.id}
              className="group flex flex-col gap-4"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video bg-neutral-900 overflow-hidden border border-white/10 group-hover:border-white/30 transition-colors">
                <img 
                  src={item.image} 
                  alt={item.project}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
                />
                
                {/* Overlay with Project Title and Play Icon */}
                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/60 p-6 text-center">
                  <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-tight mb-4 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    {item.project}
                  </h3>
                  <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20 transform scale-90 group-hover:scale-100 transition-transform duration-300">
                    <Play className="w-5 h-5 fill-white text-white ml-1" />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {/* @ts-ignore */}
              {(item.youtube || item.vimeo) && (
                <div className="flex gap-3">
                  {/* @ts-ignore */}
                  {item.youtube && (
                    <a 
                      href={item.youtube} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase border border-white/20 px-3 py-1.5 hover:bg-red-600 hover:border-red-600 transition-colors"
                    >
                      <Youtube className="w-3 h-3" />
                      <span>YouTube</span>
                    </a>
                  )}
                  {/* @ts-ignore */}
                  {item.vimeo && (
                    <a 
                      href={item.vimeo} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase border border-white/20 px-3 py-1.5 hover:bg-blue-500 hover:border-blue-500 transition-colors"
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span>Vimeo</span>
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="mt-32 text-center opacity-20 border-t border-white/10 pt-8">
          <p className="text-xs uppercase tracking-[0.5em] font-bold">End of Archive</p>
        </div>
      </div>
    </div>
  );
}
