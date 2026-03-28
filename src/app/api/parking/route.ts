import { NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Helper to calculate distance (Haversine)
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: 'API Key missing' }, { status: 500 });
  }

  try {
    // 1. Geocode the address
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const geoData = await geoRes.json();

    if (geoData.status !== 'OK' || !geoData.results[0]) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    const { lat, lng } = geoData.results[0].geometry.location;

    // 2. Search for nearby parking
    // Radius 1000m (approx 0.6 miles) covers a decent walking distance in NYC
    const placesRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1000&type=parking&keyword=parking&key=${GOOGLE_MAPS_API_KEY}`
    );
    const placesData = await placesRes.json();

    if (!placesData.results || placesData.results.length === 0) {
      return NextResponse.json({ error: 'No parking found nearby' }, { status: 404 });
    }

    // 3. Filter and Sort
    // Filter for legitimate spots (some ratings, decent rating)
    const validPlaces = placesData.results.filter((place: any) => {
        const rating = place.rating || 0;
        const count = place.user_ratings_total || 0;
        // In NYC, 3.0 is actually "okay" for a parking garage (they all have hate ratings). 
        // But "well rated" usually implies > 3.5. Let's start with 3.5 and 5 reviews.
        return rating >= 3.5 && count >= 5;
    });

    // If strict filter returns nothing, fall back to less strict
    let candidates = validPlaces;
    if (candidates.length === 0) {
        candidates = placesData.results.filter((place: any) => {
             // Fallback: Just needs to exist and not be terrible (>= 2.5) or have no rating yet
             return (place.rating || 0) >= 2.5; 
        });
    }
    
    // If still nothing, just take whatever
    if (candidates.length === 0) {
        candidates = placesData.results;
    }

    // Sort by distance
    candidates.sort((a: any, b: any) => {
        const distA = getDistanceFromLatLonInKm(lat, lng, a.geometry.location.lat, a.geometry.location.lng);
        const distB = getDistanceFromLatLonInKm(lat, lng, b.geometry.location.lat, b.geometry.location.lng);
        return distA - distB;
    });

    const bestParking = candidates[0];

    return NextResponse.json({
      name: bestParking.name,
      address: bestParking.vicinity,
      place_id: bestParking.place_id,
      lat: bestParking.geometry.location.lat,
      lng: bestParking.geometry.location.lng,
      rating: bestParking.rating,
      user_ratings_total: bestParking.user_ratings_total
    });

  } catch (error) {
    console.error('Parking API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
