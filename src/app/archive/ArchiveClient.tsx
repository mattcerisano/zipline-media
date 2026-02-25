'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, X, Play, Search, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import videos from '@/data/videos.json';

// --- Types ---
interface Video {
  title: string;
  thumbnail: string;
  videoUrl: string;
  category: string;
  collection?: string;
  uploadDate?: string;
}

// --- Helper Components ---

function HeroVideo({ video, onPlay }: { video: Video; onPlay: (url: string) => void }) {
  if (!video) return null;

  return (
    <motion.button
      layoutId={`hero-${video.title}`} 
      onClick={() => onPlay(video.videoUrl)}
      className="group relative w-full aspect-video bg-neutral-900 rounded-sm overflow-hidden border border-white/10 shadow-2xl text-left block"
    >
      <Image 
        src={video.thumbnail} 
        alt={video.title}
        fill
        sizes="(max-width: 1280px) 100vw, 60vw"
        priority
        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60" />
      
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
         <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-6 h-6 md:w-8 md:h-8 text-white fill-white ml-1" />
         </div>
      </div>

      <div className="absolute bottom-0 left-0 p-4 md:p-8 w-full">
         <h3 className="text-sm md:text-2xl font-black uppercase tracking-tight text-white leading-[1.2] line-clamp-2 md:line-clamp-none">
           {video.title}
         </h3>
      </div>
    </motion.button>
  );
}

function VideoGrid({ videos, activeVideo, onSelect }: { videos: Video[], activeVideo: Video, onSelect: (v: Video) => void }) {
  // Disable staggering on mobile for instant loading
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: isMobile ? 0 : 0.03
      }
    }
  };

  const item = {
    hidden: isMobile ? { opacity: 1 } : { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pr-2"
    >
      {videos.map((video, index) => {
        const isActive = video === activeVideo;
        return (
          <motion.button 
            variants={item}
            key={`${video.title}-${index}`}
            onClick={() => onSelect(video)}
            whileHover={{ scale: 1.03, zIndex: 20 }}
            className={`group relative aspect-video bg-neutral-900 border transition-all duration-300 rounded-sm overflow-hidden text-left
              ${isActive 
                ? 'border-white/10 xl:border-[var(--accent)] opacity-100 xl:ring-1 xl:ring-[var(--accent)] z-10' 
                : 'border-white/10 opacity-70 hover:opacity-100 hover:border-white/30'
              }
            `}
          >
            <Image 
              src={video.thumbnail} 
              alt={video.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
            />
            {isActive && (
              <div className="hidden xl:flex absolute inset-0 bg-[var(--accent)]/20 items-center justify-center">
                 <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
            )}
            <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/90 to-transparent">
               <p className="text-[10px] font-bold text-white uppercase tracking-wider line-clamp-1">
                 {video.title}
               </p>
            </div>
          </motion.button>
        );
      })}
   </motion.div>
  );
}

function CategorySection({
  categoryVideos,
  onPlay 
}: { 
  categoryVideos: Video[]; 
  onPlay: (url: string) => void; 
}) {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  // Derive the active video safely without an effect
  const activeVideo = (selectedVideo && categoryVideos.includes(selectedVideo)) 
    ? selectedVideo 
    : categoryVideos[0];

  if (categoryVideos.length === 0) return (
    <div className="py-20 text-center opacity-40 uppercase tracking-widest text-sm">No videos found.</div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8 animate-in fade-in duration-500">
      <div className="hidden xl:block xl:col-span-7 2xl:col-span-8">
        <HeroVideo video={activeVideo || categoryVideos[0]} onPlay={onPlay} />
      </div>
      <div className="xl:col-span-5 2xl:col-span-4 relative min-h-[300px] md:min-h-[400px] xl:min-h-0">
        <div className="xl:absolute xl:inset-0 overflow-y-auto no-scrollbar pb-10">
          <VideoGrid 
            key={categoryVideos[0]?.category || 'empty-grid'} 
            videos={categoryVideos} 
            activeVideo={activeVideo || categoryVideos[0]} 
            onSelect={(video) => {
              // On mobile (below xl), clicking a grid item should open the player directly
              // because the Hero video is hidden.
              if (window.innerWidth < 1280) {
                onPlay(video.videoUrl);
              } else {
                setSelectedVideo(video);
              }
            }} 
          />
        </div>
      </div>
    </div>
  );
}
// --- Big Section Components ---

function BigSection({ 
  title, 
  children,
  id 
}: { 
  title: string; 
  children: React.ReactNode; 
  id?: string;
}) {
  return (
    <section id={id} className="mb-20 scroll-mt-32">
      <motion.h2 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="text-2xl md:text-4xl lg:text-6xl font-black uppercase tracking-tighter mb-8 md:mb-12 border-b-2 border-white/10 pb-4 md:pb-6 text-white"
      >
        {title}
      </motion.h2>
      {children}
    </section>
  );
}

function PerformanceSection({ 
  allVideos, 
  onPlay 
}: { 
  allVideos: Record<string, Video[]>; 
  onPlay: (url: string) => void; 
}) {
  const subCategories = ['B-Roll', 'Commercial', 'Social', 'Events', 'Music'];
  const [activeTab, setActiveTab] = useState(subCategories[0]);

  return (
    <BigSection title="Performance" id="performance">
      <div className="flex flex-nowrap gap-2 md:gap-4 mb-8 overflow-x-auto no-scrollbar pb-2">
        {subCategories.map(sub => (
          <button
            key={sub}
            onClick={() => setActiveTab(sub)}
            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap
              ${activeTab === sub 
                ? 'bg-white text-black' 
                : 'bg-neutral-900 text-white/50 hover:bg-neutral-800 hover:text-white'
              }
            `}
          >
            {sub}
          </button>
        ))}
      </div>
      
      <CategorySection key={activeTab} categoryVideos={allVideos[activeTab] || []} onPlay={onPlay} />
    </BigSection>
  );
}

function BrandsNonprofitsSection({ 
  allVideos, 
  onPlay 
}: { 
  allVideos: Record<string, Video[]>; 
  onPlay: (url: string) => void; 
}) {
  const subCategories = ['Brands', 'Nonprofits'];
  const [activeTab, setActiveTab] = useState(subCategories[0]);

  return (
    <BigSection title="Brands" id="brands">
      <div className="flex flex-wrap gap-2 md:gap-4 mb-8">
        {subCategories.map(sub => (
          <button
            key={sub}
            onClick={() => setActiveTab(sub)}
            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-bold uppercase tracking-widest transition-all
              ${activeTab === sub 
                ? 'bg-white text-black' 
                : 'bg-neutral-900 text-white/50 hover:bg-neutral-800 hover:text-white'
              }
            `}
          >
            {sub}
          </button>
        ))}
      </div>
      
      <CategorySection key={activeTab} categoryVideos={allVideos[activeTab] || []} onPlay={onPlay} />
    </BigSection>
  );
}

function NewMediaSection({ 
  allVideos, 
  onPlay 
}: { 
  allVideos: Record<string, Video[]>; 
  onPlay: (url: string) => void; 
}) {
  return (
    <BigSection title="New Media" id="new-media">
      <CategorySection categoryVideos={allVideos['New Media'] || []} onPlay={onPlay} />
    </BigSection>
  );
}


// --- Main Client Component ---

export default function ArchiveClient() {
  const router = useRouter();
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Prevent scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = selectedVideo ? 'hidden' : 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [selectedVideo]);

  const handleBackToHome = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsExiting(true);
  };

  // Memoize video organization to prevent re-renders / shuffling
  const { videosByCategory, recentWork, allVideos } = useMemo(() => {
    const rawVideos = videos as Video[];
    
    const grouped: Record<string, Video[]> = {};
    const allCats = ['Recent Work', 'B-Roll', 'Commercial', 'Social', 'Events', 'Music', 'Brands', 'Nonprofits', 'New Media'];
    
    allCats.forEach(cat => {
      // Just filter, don't re-sort, to keep the JSON order
      grouped[cat] = rawVideos.filter(v => v.category === cat);
    });

    // Recent Work (Filtered by category)
    const recent = grouped['Recent Work'] || [];

    return { videosByCategory: grouped, recentWork: recent, allVideos: rawVideos };
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQ = searchQuery.toLowerCase();
    return allVideos.filter(v => 
      v.title.toLowerCase().includes(lowerQ) || 
      v.category.toLowerCase().includes(lowerQ)
    );
  }, [searchQuery, allVideos]);

  const getEmbedUrl = (url: string) => {
    if (url.includes('instagram.com')) {
      return url.endsWith('/embed') || url.endsWith('/embed/') 
        ? url 
        : `${url.replace(/\/$/, '')}/embed`;
    }
    return url.includes('autoplay') ? url : `${url}${url.includes('?') ? '&' : '?'}autoplay=1`;
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-12 pt-24 md:pt-40 overflow-x-hidden">
      <div className="max-w-[1800px] mx-auto">
        <header className="mb-12 md:mb-20 flex flex-col gap-6 md:gap-8">
          <Link 
            href="/" 
            onClick={handleBackToHome}
            className="flex items-center gap-2 text-xs md:text-sm uppercase tracking-[0.3em] font-bold hover:text-[var(--accent)] transition-colors w-fit opacity-70 hover:opacity-100 py-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
            <motion.h1 
              initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-[7.5vw] sm:text-4xl md:text-6xl lg:text-7xl font-black uppercase tracking-tighter leading-[0.9] whitespace-nowrap"
            >
              Video Repository
            </motion.h1>

            {/* Search Bar */}
            <motion.div 
              className="relative w-full xl:w-96"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input 
                type="text" 
                placeholder="SEARCH ARCHIVE..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-900 border border-white/10 rounded-full py-3 md:py-4 pl-12 pr-6 text-xs md:text-sm font-bold tracking-widest uppercase focus:outline-none focus:border-[var(--accent)] transition-colors text-white placeholder:text-white/30"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:text-[var(--accent)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          </div>
        </header>

        {searchQuery ? (
          /* --- Search Results --- */
          <motion.section 
            initial={isMobile ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-32"
          >
            <h2 className="text-xl font-bold uppercase tracking-widest mb-8 text-[var(--accent)] flex items-center gap-2">
              <Search className="w-5 h-5" />
              Search Results ({searchResults.length})
            </h2>
            
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {searchResults.map((video, index) => (
                  <motion.button 
                    key={`${video.title}-${index}`}
                    layoutId={`search-${video.title}-${index}`}
                    initial={isMobile ? { opacity: 1 } : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: isMobile ? 0 : index * 0.03 }}
                    onClick={() => setSelectedVideo(video.videoUrl)}
                    className="group flex flex-col gap-3 text-left w-full relative"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-neutral-900 border border-white/10 rounded-sm shadow-lg group-hover:shadow-white/10 transition-all duration-300 relative">
                      <Image 
                        src={video.thumbnail} 
                        alt={video.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                          <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2">
                        {video.title}
                      </h3>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">
                        {video.category}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center opacity-40 uppercase tracking-widest text-sm">
                No videos found matching "{searchQuery}"
              </div>
            )}
          </motion.section>
        ) : (
          /* --- Standard Layout --- */
          <>
            {/* --- Recent Work Section --- */}
            <section className="mb-20">
              <h2 className="text-xl md:text-2xl font-bold uppercase tracking-widest mb-10 text-white/40 flex items-center gap-2">
                <Star className="w-5 h-5 text-[var(--accent)]" />
                Recent Work
              </h2>
              <div 
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-4 md:gap-x-6 gap-y-8 md:gap-y-10"
              >
                {recentWork.map((video, index) => (
                  <motion.button 
                    key={`recent-${index}`}
                    initial={isMobile ? { opacity: 1 } : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: isMobile ? 0 : index * 0.05 }}
                    onClick={() => setSelectedVideo(video.videoUrl)}
                    whileHover={{ y: -5 }}
                    className="group flex flex-col gap-3 text-left w-full transition-all duration-300"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-neutral-900 border border-white/5 relative rounded-sm shadow-lg group-hover:shadow-2xl group-hover:shadow-white/5 transition-all duration-500">
                      <Image 
                        src={video.thumbnail} 
                        alt={video.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 16vw"
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 ease-out"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <h3 className="font-bold text-[10px] md:text-xs uppercase tracking-wider leading-snug group-hover:text-[var(--accent)] transition-colors opacity-60 group-hover:opacity-100 duration-300 line-clamp-2">
                      {video.title}
                    </h3>
                  </motion.button>
                ))}
              </div>
            </section>

            {/* --- Three Big Sections --- */}
            <div className="flex flex-col gap-10">
              <PerformanceSection allVideos={videosByCategory} onPlay={setSelectedVideo} />
              <BrandsNonprofitsSection allVideos={videosByCategory} onPlay={setSelectedVideo} />
              <NewMediaSection allVideos={videosByCategory} onPlay={setSelectedVideo} />
            </div>
          </>
        )}

      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 md:p-8"
          >
            <button 
              onClick={() => setSelectedVideo(null)}
              className="absolute top-4 right-4 md:top-8 md:right-8 p-2 text-white/50 hover:text-white transition-colors hover:rotate-90 duration-300 z-[110]"
            >
              <X className="w-8 h-8 md:w-10 md:h-10" />
            </button>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-6xl aspect-video bg-black shadow-2xl relative border border-white/10 rounded-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()} 
            >
              <iframe 
                src={getEmbedUrl(selectedVideo)}
                className="w-full h-full" 
                allow="autoplay; fullscreen; picture-in-picture" 
                allowFullScreen
              />
            </motion.div>
            <div className="absolute inset-0 -z-10" onClick={() => setSelectedVideo(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Exit Overlay */}
      <AnimatePresence>
        {isExiting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed inset-0 z-[200] bg-black"
            onAnimationComplete={() => router.push('/')}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
