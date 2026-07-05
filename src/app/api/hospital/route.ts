import { NextResponse } from 'next/server';
import { isSameOrigin, withinRateLimit } from '@/lib/api-guard';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function GET(request: Request) {
  if (!isSameOrigin(request) || !withinRateLimit(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address || address.length > 300) {
    return NextResponse.json({ error: 'A valid address is required' }, { status: 400 });
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
      return NextResponse.json({ 
        error: 'Address not found', 
        googleStatus: geoData.status,
        googleError: geoData.error_message 
      }, { status: 404 });
    }

    const { lat, lng } = geoData.results[0].geometry.location;

    // 2. Search for nearby hospital (Prioritize prominence to find larger/main hospitals)
    const placesRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=hospital&keyword=emergency&key=${GOOGLE_MAPS_API_KEY}`
    );
    const placesData = await placesRes.json();

    if (!placesData.results || placesData.results.length === 0) {
      return NextResponse.json({ 
        error: 'No hospital found nearby',
        googleStatus: placesData.status,
        googleError: placesData.error_message
      }, { status: 404 });
    }

    const hospital = placesData.results[0];

    return NextResponse.json({
      name: hospital.name,
      address: hospital.vicinity,
      lat: hospital.geometry.location.lat,
      lng: hospital.geometry.location.lng,
    });

  } catch (error) {
    console.error('Hospital API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
