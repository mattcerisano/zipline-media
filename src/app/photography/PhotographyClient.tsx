'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { PHOTOS_IN_PAGE_ORDER, PHOTO_CATEGORIES, photosByCategory, type Photo } from '@/data/photography';

// The grid is CSS columns rather than a JS masonry: the photos are a fixed,
// build-time list, so there is nothing to measure and nothing to re-flow.
function PhotoGrid({
  photos,
  eagerCount,
  onOpen,
}: {
  photos: Photo[];
  eagerCount: number;
  onOpen: (photo: Photo) => void;
}) {
  return (
    <div className="columns-2 md:columns-3 xl:columns-4 gap-2 md:gap-3 [column-fill:_balance]">
      {photos.map((photo, index) => (
        <button
          key={photo.src}
          type="button"
          onClick={() => onOpen(photo)}
          aria-label="Open photo"
          className="group relative mb-2 md:mb-3 block w-full break-inside-avoid overflow-hidden bg-neutral-900 cursor-zoom-in"
        >
          <Image
            src={photo.src}
            alt=""
            width={photo.width}
            height={photo.height}
            // Above-the-fold photos load immediately; the rest stay lazy. Any
            // one of the top row could be the LCP element depending on the
            // viewport, which is exactly the case the docs say not to `preload`.
            loading={index < eagerCount ? 'eager' : 'lazy'}
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="w-full h-auto transition-opacity duration-300 group-hover:opacity-80"
          />
        </button>
      ))}
    </div>
  );
}

function Lightbox({
  photo,
  onClose,
  onStep,
}: {
  photo: Photo;
  onClose: () => void;
  onStep: (delta: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onStep(1);
      if (e.key === 'ArrowLeft') onStep(-1);
    };
    window.addEventListener('keydown', onKey);
    // Without this the page behind the overlay scrolls under the photo on
    // trackpads and phones.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, onStep]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 md:p-10"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 z-10 w-11 h-11 flex items-center justify-center text-white/70 hover:text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onStep(-1);
        }}
        aria-label="Previous photo"
        className="absolute left-1 md:left-4 z-10 w-11 h-11 flex items-center justify-center text-white/50 hover:text-white transition-colors"
      >
        <ChevronLeft className="w-7 h-7" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onStep(1);
        }}
        aria-label="Next photo"
        className="absolute right-1 md:right-4 z-10 w-11 h-11 flex items-center justify-center text-white/50 hover:text-white transition-colors"
      >
        <ChevronRight className="w-7 h-7" />
      </button>

      {/* The box is what sets the size, not the image. With `w-auto` the
          browser derives the layout size from the chosen srcset candidate and
          the `w` descriptors, which rendered every photo at a third of its
          intrinsic size. Explicit height/width plus object-contain sidesteps
          that and still letterboxes both orientations. Clicking the empty
          margin beside the photo closes the viewer. */}
      <div className="flex h-[88vh] w-full items-center justify-center">
        <Image
          key={photo.src}
          src={photo.src}
          alt=""
          width={photo.width}
          height={photo.height}
          loading="eager"
          sizes="100vw"
          className="h-full w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

export default function PhotographyClient() {
  // The lightbox steps across every photo in the order the page lays them
  // out, so the index is into PHOTOS_IN_PAGE_ORDER rather than into the
  // section the photo was clicked in.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const open = useCallback((photo: Photo) => {
    setOpenIndex(PHOTOS_IN_PAGE_ORDER.indexOf(photo));
  }, []);

  const step = useCallback((delta: number) => {
    setOpenIndex((current) => {
      if (current === null) return current;
      return (current + delta + PHOTOS_IN_PAGE_ORDER.length) % PHOTOS_IN_PAGE_ORDER.length;
    });
  }, []);

  const close = useCallback(() => setOpenIndex(null), []);

  return (
    <main className="min-h-screen bg-black text-white pt-28 pb-20 px-4 md:px-8 lg:px-12">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 md:mb-16">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs tracking-[0.2em] text-white/40 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            BACK
          </Link>
          {/* LuloClean is wide and globals.css adds 0.05em of tracking to every
              heading from outside Tailwind's layers, so `tracking-tight` here
              loses to it. "Photography" therefore needs a smaller base size
              than usual to clear a 375px screen. */}
          <h1 className="text-[1.6rem] sm:text-5xl md:text-6xl font-bold">Photography</h1>
          <p className="mt-4 max-w-xl text-sm md:text-base text-white/50 leading-relaxed">
            Stills by Matt Cerisano. {PHOTOS_IN_PAGE_ORDER.length} frames, shot on film and digital.
          </p>
        </header>

        {PHOTO_CATEGORIES.map((category, categoryIndex) => {
          const photos = photosByCategory(category.id);
          if (photos.length === 0) return null;

          return (
            <section key={category.id} id={category.id} className="mb-16 md:mb-24 scroll-mt-28">
              <div className="flex items-baseline gap-4 border-b border-white/10 pb-4 mb-6 md:mb-8">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight">{category.label}</h2>
                <span className="text-xs tracking-[0.2em] text-white/30">{photos.length}</span>
                <span className="ml-auto text-xs text-white/30 hidden sm:block">{category.blurb}</span>
              </div>
              <PhotoGrid
                photos={photos}
                eagerCount={categoryIndex === 0 ? 4 : 0}
                onOpen={open}
              />
            </section>
          );
        })}
      </div>

      {openIndex !== null && (
        <Lightbox photo={PHOTOS_IN_PAGE_ORDER[openIndex]} onClose={close} onStep={step} />
      )}
    </main>
  );
}
