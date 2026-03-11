/**
 * Google Maps client — Geocoding + Distance Matrix
 * Used by smart calendar for travel time awareness.
 *
 * Env: GOOGLE_MAPS_API_KEY (geocoding), GOOGLE_MAPS_DISTANCE_KEY (distance matrix)
 */

const GEOCODE_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const DISTANCE_KEY = process.env.GOOGLE_MAPS_DISTANCE_KEY || process.env.GOOGLE_MAPS_API_KEY || '';

export type GeoResult = {
  lat: number;
  lng: number;
  formatted_address: string;
};

export type DistanceResult = {
  distance_meters: number;
  distance_text: string;
  duration_seconds: number;
  duration_text: string;
};

/**
 * Geocode an address string → lat/lng
 */
export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  if (!GEOCODE_KEY) {
    console.warn('GOOGLE_MAPS_API_KEY not set — skipping geocode');
    return null;
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('key', GEOCODE_KEY);

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  const data = await res.json();

  if (data.status !== 'OK' || !data.results?.length) {
    console.error('Geocode failed:', data.status, data.error_message);
    return null;
  }

  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formatted_address: result.formatted_address,
  };
}

/**
 * Get driving distance + duration between two points.
 * Accepts either address strings or "lat,lng" strings.
 */
export async function getDrivingDistance(
  origin: string,
  destination: string,
): Promise<DistanceResult | null> {
  if (!DISTANCE_KEY) {
    console.warn('GOOGLE_MAPS_DISTANCE_KEY not set — skipping distance calc');
    return null;
  }

  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
  url.searchParams.set('origins', origin);
  url.searchParams.set('destinations', destination);
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('key', DISTANCE_KEY);

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  const data = await res.json();

  if (data.status !== 'OK') {
    console.error('Distance Matrix failed:', data.status, data.error_message);
    return null;
  }

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    return null;
  }

  return {
    distance_meters: element.distance.value,
    distance_text: element.distance.text,
    duration_seconds: element.duration.value,
    duration_text: element.duration.text,
  };
}

/**
 * Convenience: get travel time in minutes between two addresses
 */
export async function getTravelMinutes(
  origin: string,
  destination: string,
): Promise<number | null> {
  const result = await getDrivingDistance(origin, destination);
  if (!result) return null;
  return Math.ceil(result.duration_seconds / 60);
}
