// Generated from Matt's originals (the bulk from ~/Desktop/Photography
// Portfolio): each source file — JPEG, TIFF or camera raw — was resized to an
// 1800px long edge and re-encoded as JPEG into public/photography/<category>/,
// with any EXIF orientation baked into the pixels and the tag dropped, so what
// is stored is what is shown. The dimensions below are the *output* sizes,
// which next/image needs up front so the masonry grid reserves the right box
// and the page does not reflow as photos stream in.

export type PhotoCategory = 'film' | 'digital';

export interface Photo {
  /** Path under public/, already web-sized. */
  src: string;
  width: number;
  height: number;
  category: PhotoCategory;
}

/** Source of truth for the order the sections appear in on the page. */
export const PHOTO_CATEGORIES: { id: PhotoCategory; label: string; blurb: string }[] = [
  { id: 'digital', label: 'Digital', blurb: 'Stills from sets, stages, and the road.' },
  { id: 'film', label: 'Film', blurb: '35mm, shot and scanned.' },
];

export const PHOTOS: Photo[] = [
  { src: '/photography/film/000032780027.jpg', width: 1192, height: 1800, category: 'film' },
  { src: '/photography/film/000032780034.jpg', width: 1192, height: 1800, category: 'film' },
  { src: '/photography/film/000054530007.jpg', width: 1269, height: 1800, category: 'film' },
  { src: '/photography/film/000070110012.jpg', width: 1193, height: 1800, category: 'film' },
  { src: '/photography/film/000079190009.jpg', width: 1193, height: 1800, category: 'film' },
  { src: '/photography/film/000079190022.jpg', width: 1800, height: 1193, category: 'film' },
  { src: '/photography/film/000094130034.jpg', width: 1193, height: 1800, category: 'film' },
  { src: '/photography/film/000320220039.jpg', width: 1193, height: 1800, category: 'film' },
  { src: '/photography/film/18520007.jpg', width: 1193, height: 1800, category: 'film' },
  { src: '/photography/film/33830018.jpg', width: 1193, height: 1800, category: 'film' },
  { src: '/photography/film/45890027.jpg', width: 1800, height: 1193, category: 'film' },
  { src: '/photography/film/45900020.jpg', width: 1800, height: 1193, category: 'film' },
  { src: '/photography/film/78740016.jpg', width: 1193, height: 1800, category: 'film' },
  { src: '/photography/film/s279505-r1-060-28a.jpg', width: 1800, height: 1207, category: 'film' },
  { src: '/photography/film/s627262-r1-060-28a.jpg', width: 1207, height: 1800, category: 'film' },
  { src: '/photography/film/s632613-r1-025-11.jpg', width: 1800, height: 1207, category: 'film' },
  { src: '/photography/film/s632613-r1-047-22.jpg', width: 1207, height: 1800, category: 'film' },
  { src: '/photography/digital/1099704.jpg', width: 1014, height: 1800, category: 'digital' },
  { src: '/photography/digital/1111158.jpg', width: 1800, height: 1350, category: 'digital' },
  { src: '/photography/digital/1122361.jpg', width: 1800, height: 1350, category: 'digital' },
  { src: '/photography/digital/1122526.jpg', width: 1346, height: 1800, category: 'digital' },
  { src: '/photography/digital/1122559.jpg', width: 1800, height: 1350, category: 'digital' },
  { src: '/photography/digital/1155063.jpg', width: 1350, height: 1800, category: 'digital' },
  { src: '/photography/digital/1155544.jpg', width: 1800, height: 1200, category: 'digital' },
  { src: '/photography/digital/1155560.jpg', width: 1200, height: 1800, category: 'digital' },
  { src: '/photography/digital/1155654.jpg', width: 1350, height: 1800, category: 'digital' },
  { src: '/photography/digital/1166859-1.jpg', width: 1800, height: 1350, category: 'digital' },
  { src: '/photography/digital/1188677.jpg', width: 1351, height: 1800, category: 'digital' },
  { src: '/photography/digital/a7r03963.jpg', width: 1800, height: 1200, category: 'digital' },
  { src: '/photography/digital/a7s01137.jpg', width: 1800, height: 1204, category: 'digital' },
  { src: '/photography/digital/alliance2293.jpg', width: 1200, height: 1800, category: 'digital' },
  { src: '/photography/digital/alliance774.jpg', width: 1200, height: 1800, category: 'digital' },
  { src: '/photography/digital/as-1-of-1-1.jpg', width: 1200, height: 1800, category: 'digital' },
  { src: '/photography/digital/as-1-of-1.jpg', width: 1350, height: 1800, category: 'digital' },
  { src: '/photography/digital/as-102-of-381.jpg', width: 1800, height: 1013, category: 'digital' },
  { src: '/photography/digital/as-13-of-15.jpg', width: 1158, height: 1800, category: 'digital' },
  { src: '/photography/digital/as-16-of-16.jpg', width: 1350, height: 1800, category: 'digital' },
  { src: '/photography/digital/canon-eos-rebel-t3i2861asd.jpg', width: 1800, height: 1339, category: 'digital' },
  { src: '/photography/digital/canon-eos-rebel-t3i2864asd.jpg', width: 1800, height: 1200, category: 'digital' },
  { src: '/photography/digital/d6d320be-68da-4c5a-8176-9f5fed65de1a.jpg', width: 1439, height: 1800, category: 'digital' },
  { src: '/photography/digital/dsc00024.jpg', width: 1202, height: 1800, category: 'digital' },
  { src: '/photography/digital/dsc00041.jpg', width: 1800, height: 1202, category: 'digital' },
  { src: '/photography/digital/dsc00157.jpg', width: 1800, height: 1202, category: 'digital' },
  { src: '/photography/digital/dsc00294.jpg', width: 1800, height: 1201, category: 'digital' },
  { src: '/photography/digital/dsc08649.jpg', width: 1800, height: 1202, category: 'digital' },
  { src: '/photography/digital/group-alliance2791.jpg', width: 1800, height: 1200, category: 'digital' },
  { src: '/photography/digital/img-2988.jpg', width: 1800, height: 1269, category: 'digital' },
  { src: '/photography/digital/lfl-03-07-26-20.jpg', width: 1202, height: 1800, category: 'digital' },
  { src: '/photography/digital/mjc04676.jpg', width: 1200, height: 1800, category: 'digital' },
  { src: '/photography/digital/mjc04796.jpg', width: 1800, height: 1200, category: 'digital' },
  { src: '/photography/digital/mjc05152.jpg', width: 1800, height: 1200, category: 'digital' },
  { src: '/photography/digital/mjc05161.jpg', width: 1800, height: 1012, category: 'digital' },
  { src: '/photography/digital/mjc05178.jpg', width: 1800, height: 1012, category: 'digital' },
  { src: '/photography/digital/mjc05182.jpg', width: 1012, height: 1800, category: 'digital' },
  { src: '/photography/digital/rts01856.jpg', width: 1200, height: 1800, category: 'digital' },
  { src: '/photography/digital/rts01858.jpg', width: 1800, height: 1200, category: 'digital' },
  { src: '/photography/digital/tmo01353.jpg', width: 1800, height: 1200, category: 'digital' },
  { src: '/photography/digital/tmo01773.jpg', width: 1800, height: 1200, category: 'digital' },
  { src: '/photography/digital/tmo03345.jpg', width: 1200, height: 1800, category: 'digital' },
  { src: '/photography/digital/w-r-19.jpg', width: 1200, height: 1800, category: 'digital' },
  { src: '/photography/digital/zeta25-visionstage-01-3383.jpg', width: 1800, height: 1200, category: 'digital' },
  { src: '/photography/digital/zeta25.jpg', width: 1800, height: 1200, category: 'digital' },
];

export function photosByCategory(category: PhotoCategory): Photo[] {
  return PHOTOS.filter((photo) => photo.category === category);
}

/**
 * PHOTOS grouped the way the page lays them out, so the lightbox steps in the
 * order a visitor reads rather than in whatever order the list happens to be
 * written. Reordering PHOTO_CATEGORIES is enough to move a whole section.
 */
export const PHOTOS_IN_PAGE_ORDER: Photo[] = PHOTO_CATEGORIES.flatMap((category) =>
  photosByCategory(category.id),
);
