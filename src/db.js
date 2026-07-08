import Dexie from 'dexie';

export const db = new Dexie('BeeTimeDatabase');

// Define database schema
db.version(3).stores({
  shows: 'id, name, is_favorite, last_updated',
  seasons: 'id, show_id, season_number',
  episodes: 'id, show_id, season_number, [show_id+season_number], air_date',
  watched_episodes: '++id, show_id, watched_at, [show_id+season_number+episode_number]',
  movies: 'id, title, is_favorite, watched, is_watchlist, watched_at',
  settings: 'key',
  watchlist: 'show_id, added_at',
  lists: '++id, name, description'
});

// Pre-populate database with user's TMDB API key if not present
db.on('ready', async () => {
  try {
    const key = await db.settings.get('tmdb_api_key');
    if (!key) {
      await db.settings.put({ key: 'tmdb_api_key', value: 'a8a09129aec8b2a5e7729b2f5b239cb5' });
    }
    const user = await db.settings.get('username');
    if (!user) {
      await db.settings.put({ key: 'username', value: 'Utilizador' });
    }
  } catch (err) {
    console.error('Erro ao inicializar base de dados:', err);
  }
});

// Helper functions for Database interactions

// Get user setting
export async function getSetting(key, defaultValue = null) {
  const setting = await db.settings.get(key);
  return setting ? setting.value : defaultValue;
}

// Set user setting
export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

// Add a show and its episodes to the database
export async function saveShowToDB(showData, seasonsData) {
  await db.transaction('rw', [db.shows, db.seasons, db.episodes], async () => {
    // Save show summary
    await db.shows.put({
      id: showData.id,
      name: showData.name,
      poster_path: showData.poster_path,
      backdrop_path: showData.backdrop_path,
      status: showData.status,
      overview: showData.overview,
      number_of_seasons: showData.number_of_seasons,
      number_of_episodes: showData.number_of_episodes,
      genres: showData.genres || [],
      networks: showData.networks ? showData.networks.map(n => n.name).join(', ') : '',
      last_updated: Date.now(),
      is_favorite: showData.is_favorite || 0,
      runtime: showData.episode_run_time ? showData.episode_run_time[0] || 45 : 45
    });

    // Save seasons & episodes
    for (const season of seasonsData) {
      if (!season) continue;
      
      const seasonId = `${showData.id}_${season.season_number}`;
      await db.seasons.put({
        id: seasonId,
        show_id: showData.id,
        season_number: season.season_number,
        episode_count: season.episodes ? season.episodes.length : 0,
        name: season.name || `Season ${season.season_number}`
      });

      if (season.episodes) {
        const episodeRecords = season.episodes.map(ep => ({
          id: `${showData.id}_${season.season_number}_${ep.episode_number}`,
          show_id: showData.id,
          season_number: season.season_number,
          episode_number: ep.episode_number,
          name: ep.name,
          air_date: ep.air_date,
          overview: ep.overview,
          runtime: ep.runtime || showData.episode_run_time?.[0] || 45
        }));
        await db.episodes.bulkPut(episodeRecords);
      }
    }
  });
}

// Toggle watch status of a single episode
export async function toggleEpisodeWatch(showId, seasonNumber, episodeNumber, watchStatus = null, customDate = null) {
  const compositeKey = [showId, seasonNumber, episodeNumber];
  
  // Find if already watched
  const watched = await db.watched_episodes
    .where('[show_id+season_number+episode_number]')
    .equals(compositeKey)
    .first();

  if (watched && watchStatus === false) {
    // Delete watch record
    await db.watched_episodes.delete(watched.id);
    return false;
  } else if (!watched && watchStatus !== false) {
    // Add watch record
    await db.watched_episodes.add({
      show_id: showId,
      season_number: seasonNumber,
      episode_number: episodeNumber,
      watched_at: customDate || new Date().toISOString(),
      rating: 0,
      reaction: ''
    });
    return true;
  }
  return !!watched;
}

// Check watch status of a show's episodes
export async function getWatchedEpisodesForShow(showId) {
  return await db.watched_episodes
    .where('show_id')
    .equals(showId)
    .toArray();
}

// Mark an entire season as watched
export async function watchEntireSeason(showId, seasonNumber, episodesList) {
  await db.transaction('rw', [db.watched_episodes], async () => {
    for (const ep of episodesList) {
      const compositeKey = [showId, seasonNumber, ep.episode_number];
      const exists = await db.watched_episodes
        .where('[show_id+season_number+episode_number]')
        .equals(compositeKey)
        .first();
      
      if (!exists) {
        await db.watched_episodes.add({
          show_id: showId,
          season_number: seasonNumber,
          episode_number: ep.episode_number,
          watched_at: new Date().toISOString(),
          rating: 0,
          reaction: ''
        });
      }
    }
  });
}

// Mark an entire season as unwatched
export async function unwatchEntireSeason(showId, seasonNumber) {
  const watched = await db.watched_episodes
    .where('show_id')
    .equals(showId)
    .toArray();
  
  const idsToDelete = watched
    .filter(w => w.season_number === seasonNumber)
    .map(w => w.id);

  if (idsToDelete.length > 0) {
    await db.watched_episodes.bulkDelete(idsToDelete);
  }
}

// Get statistics
export async function getWatchStats() {
  const watchedEps = await db.watched_episodes.toArray();
  const watchedMovies = await db.movies.where('watched').equals(1).toArray();
  const shows = await db.shows.toArray();

  // Create a map of show_id -> show runtime
  const showRuntimes = {};
  shows.forEach(s => {
    showRuntimes[s.id] = s.runtime || 45;
  });

  // Calculate TV watch time (minutes)
  let tvMinutes = 0;
  for (const ep of watchedEps) {
    const runtime = showRuntimes[ep.show_id] || 45;
    tvMinutes += runtime;
  }

  // Calculate Movie watch time (minutes)
  let movieMinutes = 0;
  watchedMovies.forEach(m => {
    movieMinutes += m.runtime || 120;
  });

  const totalMinutes = tvMinutes + movieMinutes;

  return {
    totalShows: shows.length,
    totalEpisodes: watchedEps.length,
    totalMovies: watchedMovies.length,
    totalMinutes,
    tvMinutes,
    movieMinutes
  };
}
