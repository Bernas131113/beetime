import { getSetting } from './db';

const BASE_URL = 'https://api.themoviedb.org/3';

async function getApiKey() {
  return await getSetting('tmdb_api_key', '');
}

async function request(endpoint, params = {}) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }

  const queryParams = new URLSearchParams({
    api_key: apiKey,
    language: 'pt-PT', // Prefer Portuguese
    ...params
  });

  const url = `${BASE_URL}${endpoint}?${queryParams.toString()}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('INVALID_API_KEY');
    }
    throw new Error(`TMDB_API_ERROR: ${response.statusText}`);
  }

  return await response.json();
}

export async function testApiKey(key) {
  const url = `${BASE_URL}/authentication/guest_session/new?api_key=${key}`;
  const response = await fetch(url);
  return response.ok;
}

export async function searchMulti(query, page = 1) {
  return await request('/search/multi', { query, page });
}

export async function searchTV(query, page = 1) {
  return await request('/search/tv', { query, page });
}

export async function searchMovie(query, page = 1) {
  return await request('/search/movie', { query, page });
}

export async function getTVDetails(id) {
  return await request(`/tv/${id}`);
}

export async function getTVSeason(tvId, seasonNumber) {
  return await request(`/tv/${tvId}/season/${seasonNumber}`);
}

export async function getMovieDetails(id) {
  return await request(`/movie/${id}`);
}

export async function getTrendingTV(timeWindow = 'week') {
  return await request(`/trending/tv/${timeWindow}`);
}

export async function getTrendingMovies(timeWindow = 'week') {
  return await request(`/trending/movie/${timeWindow}`);
}

export function getImageUrl(path, size = 'w500') {
  if (!path) return 'https://placehold.co/500x750/1e293b/ffffff?text=Sem+Imagem';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export async function getTVCredits(id) {
  return await request(`/tv/${id}/credits`);
}

export async function getTVRecommendations(id) {
  return await request(`/tv/${id}/recommendations`);
}

export async function getMovieCredits(id) {
  return await request(`/movie/${id}/credits`);
}

export async function getMovieRecommendations(id) {
  return await request(`/movie/${id}/recommendations`);
}

export async function getTVVideos(id) {
  const res = await request(`/tv/${id}/videos`);
  if (res && res.results && res.results.length > 0) {
    return res;
  }
  return await request(`/tv/${id}/videos`, { language: 'en-US' });
}

export async function getMovieVideos(id) {
  const res = await request(`/movie/${id}/videos`);
  if (res && res.results && res.results.length > 0) {
    return res;
  }
  return await request(`/movie/${id}/videos`, { language: 'en-US' });
}

export async function getTVWatchProviders(id) {
  return await request(`/tv/${id}/watch/providers`);
}

export async function getMovieWatchProviders(id) {
  return await request(`/movie/${id}/watch/providers`);
}
