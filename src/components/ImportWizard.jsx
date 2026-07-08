import React, { useState } from 'react';
import { db, saveShowToDB, toggleEpisodeWatch } from '../db';
import { searchTV, searchMovie, getTVDetails, getTVSeason, getMovieDetails, getImageUrl } from '../tmdb';
import { Upload, Check, AlertCircle, Loader, ArrowRight, FolderOpen, HelpCircle, Film, Tv } from 'lucide-react';
import JSZip from 'jszip';

export default function ImportWizard({ onImportComplete, onClose }) {
  const [step, setStep] = useState(1); // 1: Upload, 1.5: Reading Files, 2: Searching TMDB, 2.5: Resolving Doubts, 3: Importing, 4: Complete
  const [filesCount, setFilesCount] = useState(0);
  const [error, setError] = useState(null);

  // Lists extracted from CSVs
  const [parsedShows, setParsedShows] = useState([]);
  const [parsedMovies, setParsedMovies] = useState([]);

  // Sourced TMDB mappings
  const [showMappings, setShowMappings] = useState({}); // originalName -> tmdbId (or null to skip)
  const [movieMappings, setMovieMappings] = useState({}); // originalName -> tmdbId (or null to skip)

  // TMDB Doubts queue
  const [doubtsQueue, setDoubtsQueue] = useState([]); // Array of { type: 'show'|'movie', originalName: string, candidates: [...], data: showObj|movieObj }
  const [currentDoubtIndex, setCurrentDoubtIndex] = useState(0);

  // Progress tracking
  const [progress, setProgress] = useState({ current: 0, total: 0, itemName: '', status: '' });
  const [importCounts, setImportCounts] = useState({ shows: 0, movies: 0 });

  // Robust client-side CSV parser
  function parseCSV(text) {
    const lines = [];
    let row = [''];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push('');
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') i++;
        lines.push(row);
        row = [''];
        inQuotes = false;
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== '') {
      lines.push(row);
    }
    return lines;
  }

  // Parses the GDPR files extracted from ZIP or folder
  const processGDPRFiles = (fileList) => {
    const showsMap = new Map(); // name -> { name, isFollowed: false, watchedEpisodes: [] }
    const moviesMap = new Map(); // name -> { name, isWatchlist: false, watched: false, date: null }

    fileList.forEach(({ name, text }) => {
      const parsed = parseCSV(text);
      if (parsed.length < 2) return;

      const headers = parsed[0].map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      const rows = parsed.slice(1).filter(r => r.length === headers.length || r.join('').trim() !== '');

      const getColIndex = (colNames) => {
        return headers.findIndex(h => colNames.includes(h));
      };

      // 1. Followed TV Shows
      if (name.includes('followed_tv_show')) {
        const showNameIdx = getColIndex(['tv_show_name', 'series_name', 'show_name']);
        if (showNameIdx !== -1) {
          rows.forEach(row => {
            const showName = row[showNameIdx]?.trim().replace(/^"|"$/g, '');
            if (!showName) return;
            if (!showsMap.has(showName)) {
              showsMap.set(showName, { name: showName, isFollowed: true, watchedEpisodes: [] });
            } else {
              showsMap.get(showName).isFollowed = true;
            }
          });
        }
      }

      // 2. Seen TV Shows / Episodes / Movies (Tracking records)
      if (
        name.includes('tracking-prod-records-v2') || 
        name.includes('tracking-prod-records') || 
        name.includes('seen_episode') ||
        name.includes('show_seen_episode')
      ) {
        const seriesNameIdx = getColIndex(['series_name', 'show_name', 'tv_show_name']);
        const seasonIdx = getColIndex(['season_number', 's_no', 'episode_season_number', 'episode_season_no']);
        const epIdx = getColIndex(['episode_number', 'ep_no', 'episode_id_latest', 'episode_no']);
        const dateIdx = getColIndex(['created_at', 'watch_date', 'updated_at']);

        const movieNameIdx = getColIndex(['movie_name']);
        const entityTypeIdx = getColIndex(['entity_type']);
        const typeIdx = getColIndex(['type']);

        rows.forEach(row => {
          const seriesName = seriesNameIdx !== -1 ? row[seriesNameIdx]?.trim().replace(/^"|"$/g, '') : null;
          const movieName = movieNameIdx !== -1 ? row[movieNameIdx]?.trim().replace(/^"|"$/g, '') : null;
          const entityType = entityTypeIdx !== -1 ? row[entityTypeIdx]?.trim().toLowerCase() : '';
          const recordType = typeIdx !== -1 ? row[typeIdx]?.trim().toLowerCase() : '';
          const date = dateIdx !== -1 ? row[dateIdx]?.trim() : new Date().toISOString();

          // Is it a Movie?
          if (entityType === 'movie' || (movieName && movieName.trim()) || recordType.includes('movie')) {
            const mName = movieName || seriesName;
            if (!mName) return;

            if (!moviesMap.has(mName)) {
              moviesMap.set(mName, { name: mName, isWatchlist: false, watched: false, date: null });
            }
            const mObj = moviesMap.get(mName);

            if (recordType === 'follow' || recordType === 'towatch') {
              mObj.isWatchlist = true;
            } else if (recordType === 'watch' || recordType === 'rewatch') {
              mObj.watched = true;
              mObj.date = date;
            }
          } 
          // Is it a TV Show?
          else if (seriesName && seriesName.trim()) {
            const season = seasonIdx !== -1 ? parseInt(row[seasonIdx]) || 1 : 1;
            const episode = epIdx !== -1 ? parseInt(row[epIdx]) || 1 : 1;

            if (!showsMap.has(seriesName)) {
              showsMap.set(seriesName, { name: seriesName, isFollowed: false, watchedEpisodes: [] });
            }
            const showObj = showsMap.get(seriesName);
            showObj.watchedEpisodes.push({ season, episode, date });
          }
        });
      }
    }
  );

    return {
      shows: Array.from(showsMap.values()),
      movies: Array.from(moviesMap.values())
    };
  };

  // Safe cleaner for media names to fix TMDB matching
  const cleanMediaName = (name) => {
    return name
      .replace(/\s*\(\d{4}\)\s*$/, '')          // Remove trailing year: "(2020)"
      .replace(/\s*\([A-Za-z]{2,}\)\s*$/, '')    // Remove trailing country tags: "(PT)", "(BR)", "(US)"
      .trim();
  };

  // Core file selector loader
  const handleFileSelection = async (e, isFolder = false) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setStep(1.5); // Reading files...
    setError(null);
    setFilesCount(files.length);

    try {
      const extractedFiles = [];

      // 1. If it is a single ZIP file
      if (files.length === 1 && files[0].name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(files[0]);
        const zipKeys = Object.keys(zip.files);
        
        for (const key of zipKeys) {
          if (key.endsWith('.csv')) {
            const text = await zip.files[key].async('string');
            extractedFiles.push({ name: key, text });
          }
        }
      } 
      // 2. If folder directory upload or multiple CSVs selected
      else {
        for (const file of files) {
          if (file.name.endsWith('.csv')) {
            const text = await new Promise((resolve, reject) => {
              const r = new FileReader();
              r.onload = (ev) => resolve(ev.target.result);
              r.onerror = reject;
              r.readAsText(file);
            });
            extractedFiles.push({ name: file.name, text });
          }
        }
      }

      if (extractedFiles.length === 0) {
        throw new Error('Nenhum ficheiro CSV do histórico do TV Time foi detetado.');
      }

      // Process and extract shows & movies
      const data = processGDPRFiles(extractedFiles);
      setParsedShows(data.shows);
      setParsedMovies(data.movies);

      // Start TMDB Auto-Matching step
      startTMDBMatching(data.shows, data.movies);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao processar ficheiros de importação.');
      setStep(1);
    }
  };

  // Query TMDB to auto-match names and queue doubts
  const startTMDBMatching = async (shows, movies) => {
    setStep(2); // Searching TMDB...
    
    const totalItems = shows.length + movies.length;
    setProgress({ current: 0, total: totalItems, itemName: '', status: 'A preparar pesquisa no TMDB...' });

    const showsMatches = {};
    const moviesMatches = {};
    const doubts = [];
    let count = 0;

    const normalizeString = (str) => {
      if (!str) return '';
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')       // Keep only alphanumeric characters
        .trim();
    };

    // Helper to process show search
    const processShowSearch = async (show) => {
      const cleaned = cleanMediaName(show.name);
      try {
        const searchRes = await searchTV(cleaned);
        const results = searchRes.results || [];
        
        if (results.length === 1) {
          // If only 1 result returned, auto-select it directly
          showsMatches[show.name] = results[0].id;
        } else {
          // Check for exact match in both localized and original name
          const queryNorm = normalizeString(cleaned);
          const exact = results.find(r => {
            const nameNorm = normalizeString(r.name);
            const origNameNorm = normalizeString(r.original_name);
            return nameNorm === queryNorm || origNameNorm === queryNorm;
          });

          if (exact) {
            showsMatches[show.name] = exact.id;
          } else if (results.length > 0) {
            // Ambiguous: add to doubts
            doubts.push({
              type: 'show',
              originalName: show.name,
              cleanedName: cleaned,
              candidates: results.slice(0, 5),
              data: show
            });
          } else {
            // Not found
            showsMatches[show.name] = null;
          }
        }
      } catch (e) {
        console.warn(`Search failed for show ${show.name}:`, e);
        showsMatches[show.name] = null;
      }
    };

    // Helper to process movie search
    const processMovieSearch = async (movie) => {
      const cleaned = cleanMediaName(movie.name);
      try {
        const searchRes = await searchMovie(cleaned);
        const results = searchRes.results || [];

        if (results.length === 1) {
          // If only 1 result returned, auto-select it directly
          moviesMatches[movie.name] = results[0].id;
        } else {
          // Check for exact match in both localized and original title
          const queryNorm = normalizeString(cleaned);
          const exact = results.find(r => {
            const titleNorm = normalizeString(r.title);
            const origTitleNorm = normalizeString(r.original_title);
            return titleNorm === queryNorm || origTitleNorm === queryNorm;
          });

          if (exact) {
            moviesMatches[movie.name] = exact.id;
          } else if (results.length > 0) {
            // Ambiguous: add to doubts
            doubts.push({
              type: 'movie',
              originalName: movie.name,
              cleanedName: cleaned,
              candidates: results.slice(0, 5),
              data: movie
            });
          } else {
            // Not found
            moviesMatches[movie.name] = null;
          }
        }
      } catch (e) {
        console.warn(`Search failed for movie ${movie.name}:`, e);
        moviesMatches[movie.name] = null;
      }
    };

    // Run parallel searches in chunks of 8 concurrent requests to speed up
    const pLimit = 8;
    
    // Process TV Shows
    for (let i = 0; i < shows.length; i += pLimit) {
      const slice = shows.slice(i, i + pLimit);
      await Promise.all(slice.map(async (show) => {
        await processShowSearch(show);
        count++;
        setProgress(prev => ({
          ...prev,
          current: count,
          itemName: show.name,
          status: `A procurar séries (${count}/${totalItems})...`
        }));
      }));
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Process Movies
    for (let i = 0; i < movies.length; i += pLimit) {
      const slice = movies.slice(i, i + pLimit);
      await Promise.all(slice.map(async (movie) => {
        await processMovieSearch(movie);
        count++;
        setProgress(prev => ({
          ...prev,
          current: count,
          itemName: movie.name,
          status: `A procurar filmes (${count}/${totalItems})...`
        }));
      }));
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Save current mappings state
    setShowMappings(showsMatches);
    setMovieMappings(moviesMatches);
    setDoubtsQueue(doubts);

    // If there are doubts, go to Doubts Resolution, otherwise proceed to Import!
    if (doubts.length > 0) {
      setCurrentDoubtIndex(0);
      setStep(2.5); // Resolver Dúvidas
    } else {
      executeFinalImport(showsMatches, moviesMatches, shows, movies);
    }
  };

  // Resolve a single doubt candidate
  const handleResolveDoubt = (candidateId) => {
    const currentDoubt = doubtsQueue[currentDoubtIndex];
    if (currentDoubt.type === 'show') {
      setShowMappings(prev => ({ ...prev, [currentDoubt.originalName]: candidateId }));
    } else {
      setMovieMappings(prev => ({ ...prev, [currentDoubt.originalName]: candidateId }));
    }

    moveToNextDoubt();
  };

  // Skip single doubt
  const handleSkipDoubt = () => {
    const currentDoubt = doubtsQueue[currentDoubtIndex];
    if (currentDoubt.type === 'show') {
      setShowMappings(prev => ({ ...prev, [currentDoubt.originalName]: null }));
    } else {
      setMovieMappings(prev => ({ ...prev, [currentDoubt.originalName]: null }));
    }

    moveToNextDoubt();
  };

  // Move forward in doubts resolver or start import
  const moveToNextDoubt = () => {
    if (currentDoubtIndex + 1 < doubtsQueue.length) {
      setCurrentDoubtIndex(currentDoubtIndex + 1);
    } else {
      // Completed resolving doubts! Proceed with final import.
      executeFinalImport(showMappings, movieMappings, parsedShows, parsedMovies);
    }
  };

  // Skip all remaining doubts and start importing
  const handleSkipRemainingDoubts = () => {
    // Fill remaining mappings in queue with null
    const finalShows = { ...showMappings };
    const finalMovies = { ...movieMappings };

    for (let i = currentDoubtIndex; i < doubtsQueue.length; i++) {
      const doubt = doubtsQueue[i];
      if (doubt.type === 'show') {
        finalShows[doubt.originalName] = null;
      } else {
        finalMovies[doubt.originalName] = null;
      }
    }

    setShowMappings(finalShows);
    setMovieMappings(finalMovies);
    executeFinalImport(finalShows, finalMovies, parsedShows, parsedMovies);
  };

  // Execute full database writes and TMDB downloads
  const executeFinalImport = async (showsMap, moviesMap, showsList, moviesList) => {
    setStep(3); // Importing...
    
    // Filter items that have mapped TMDB IDs
    const showsToImport = showsList.filter(s => showsMap[s.name] !== null && showsMap[s.name] !== undefined);
    const moviesToImport = moviesList.filter(m => moviesMap[m.name] !== null && moviesMap[m.name] !== undefined);

    const totalToImport = showsToImport.length + moviesToImport.length;
    setProgress({ current: 0, total: totalToImport, itemName: '', status: 'A carregar ficheiros locais...' });

    let showsImported = 0;
    let moviesImported = 0;
    let processedCount = 0;

    // 1. Import TV Shows (downloads details, seasons, episodes, and inserts)
    for (const show of showsToImport) {
      const tmdbId = showsMap[show.name];
      processedCount++;
      setProgress({
        current: processedCount,
        total: totalToImport,
        itemName: show.name,
        status: `A sincronizar série com TMDB (${processedCount}/${totalToImport})...`
      });

      try {
        const showDetails = await getTVDetails(tmdbId);

        // Fetch each season detail in parallel!
        const seasonPromises = [];
        for (let s = 1; s <= showDetails.number_of_seasons; s++) {
          seasonPromises.push(
            getTVSeason(tmdbId, s).catch(e => {
              console.warn(`Could not fetch season ${s} for ${show.name}:`, e);
              return null;
            })
          );
        }
        const resolvedSeasons = await Promise.all(seasonPromises);
        const seasonsData = resolvedSeasons.filter(s => s !== null);

        // Save show details locally
        await saveShowToDB(showDetails, seasonsData);

        // Add to watchlist if followed
        if (show.isFollowed) {
          await db.watchlist.put({
            show_id: tmdbId,
            added_at: new Date().toISOString(),
            is_archive: 0
          });
        }

        // Add watched episodes in bulk (optimized!)
        const watchedRecords = show.watchedEpisodes.map(ep => ({
          show_id: tmdbId,
          season_number: ep.season,
          episode_number: ep.episode,
          watched_at: ep.date || new Date().toISOString(),
          rating: 0,
          reaction: ''
        }));
        if (watchedRecords.length > 0) {
          await db.watched_episodes.bulkPut(watchedRecords);
        }

        showsImported++;
      } catch (err) {
        console.error(`Error importing show ${show.name}:`, err);
      }
    }

    // 2. Import Movies
    for (const movie of moviesToImport) {
      const tmdbId = moviesMap[movie.name];
      processedCount++;
      setProgress({
        current: processedCount,
        total: totalToImport,
        itemName: movie.name,
        status: `A sincronizar filme com TMDB (${processedCount}/${totalToImport})...`
      });

      try {
        const movieDetails = await getMovieDetails(tmdbId);

        await db.movies.put({
          id: movieDetails.id,
          title: movieDetails.title,
          poster_path: movieDetails.poster_path,
          backdrop_path: movieDetails.backdrop_path,
          release_date: movieDetails.release_date,
          overview: movieDetails.overview,
          runtime: movieDetails.runtime || 120,
          is_favorite: 0,
          watched: movie.watched ? 1 : 0,
          is_watchlist: movie.isWatchlist ? 1 : 0,
          genres: (movieDetails.genres || []).map(g => g.name).join(', '),
          rating: 0,
          reaction: '',
          watched_at: movie.date || null
        });

        moviesImported++;
      } catch (err) {
        console.error(`Error importing movie ${movie.name}:`, err);
      }
    }

    setImportCounts({ shows: showsImported, movies: moviesImported });
    setStep(4); // Complete!
    if (onImportComplete) {
      onImportComplete(showsImported + moviesImported);
    }
  };

  const currentDoubt = doubtsQueue[currentDoubtIndex];

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Importador GDPR TV Time</h3>
          <button onClick={onClose} className="btn btn-secondary btn-icon-only">✕</button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          
          {/* STEP 1: Upload options */}
          {step === 1 && (
            <div style={{ textAlign: 'center', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Upload size={44} style={{ color: 'var(--yellow-brand)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>Carrega a tua exportação</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.4' }}>
                  Não precisas de escolher colunas! Carrega a pasta descompactada <code>gdpr-data</code> ou o ficheiro <code>.zip</code> da tua conta do TV Time.
                </p>
              </div>

              {/* Upload ZIP or CSV files button */}
              <label className="btn btn-primary" style={{ display: 'flex', width: '100%', cursor: 'pointer', borderRadius: '24px', padding: '12px', justifyContent: 'center', fontSize: '12px' }}>
                <FolderOpen size={16} style={{ marginRight: '6px' }} />
                Selecionar Ficheiro ZIP ou CSVs
                <input 
                  type="file" 
                  accept=".zip,.csv" 
                  multiple
                  onChange={(e) => handleFileSelection(e, false)} 
                  style={{ display: 'none' }} 
                />
              </label>

              {/* Webkitdirectory Folder upload button */}
              <label className="btn btn-secondary" style={{ display: 'flex', width: '100%', cursor: 'pointer', borderRadius: '24px', padding: '12px', justifyContent: 'center', fontSize: '12px' }}>
                <FolderOpen size={16} style={{ marginRight: '6px' }} />
                Selecionar Pasta gdpr-data
                <input 
                  type="file" 
                  webkitdirectory="" 
                  directory="" 
                  onChange={(e) => handleFileSelection(e, true)} 
                  style={{ display: 'none' }} 
                />
              </label>

              {error && (
                <div style={{ display: 'flex', gap: '8px', padding: '12px', background: 'rgba(248, 79, 95, 0.1)', color: 'var(--red-accent)', borderRadius: '12px', fontSize: '12px', alignItems: 'center', textAlign: 'left' }}>
                  <AlertCircle size={20} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 1.5: Extraction loading */}
          {step === 1.5 && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <div className="tvtime-loader" />
              </div>
              <h4 style={{ marginBottom: '10px', fontSize: '15px' }}>A extrair ficheiros do TV Time...</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                A ler os ficheiros do teu histórico. Isto demora apenas alguns segundos.
              </p>
            </div>
          )}

          {/* STEP 2: TMDB Querying progress */}
          {step === 2 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <div className="tvtime-loader" />
              </div>
              <h4 style={{ marginBottom: '10px', fontSize: '15px' }}>A pesquisar no TMDB...</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
                A encontrar correspondências automáticas para séries e filmes sem intervenção manual.
              </p>
              
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                <div 
                  style={{ height: '100%', backgroundColor: 'var(--yellow-brand)', width: `${(progress.current / progress.total) * 100}%`, transition: 'width 0.25s' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '800' }}>
                <span>{progress.current} de {progress.total} analisados</span>
                <span>{Math.round((progress.current / progress.total) * 100)}%</span>
              </div>

              <div style={{ marginTop: '16px', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }}>
                <span style={{ fontWeight: '800', color: 'var(--text-primary)' }}>A analisar:</span>
                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {progress.itemName || 'A processar...'}
                </p>
              </div>
            </div>
          )}

          {/* STEP 2.5: Doubts Resolver (The user resolves duplicates manually) */}
          {step === 2.5 && currentDoubt && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--yellow-brand)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  Resolver Dúvida ({currentDoubtIndex + 1} de {doubtsQueue.length})
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '800' }}>
                  {currentDoubt.type === 'show' ? <Tv size={14} /> : <Film size={14} />} {currentDoubt.type === 'show' ? 'SÉRIE' : 'FILME'}
                </span>
              </div>

              <h4 style={{ fontSize: '14.5px', fontWeight: '900', color: 'var(--text-primary)', lineHeight: '1.3' }}>
                Qual destas opções corresponde a: <br/>
                <span style={{ color: 'var(--yellow-brand)', fontSize: '18px', fontWeight: '900' }}>"{currentDoubt.originalName}"</span>?
              </h4>

              {/* Scrollable list of candidates posters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                {currentDoubt.candidates.map(candidate => {
                  const title = candidate.name || candidate.title;
                  const year = candidate.first_air_date || candidate.release_date 
                    ? new Date(candidate.first_air_date || candidate.release_date).getFullYear() 
                    : '';
                  
                  return (
                    <div
                      key={candidate.id}
                      onClick={() => handleResolveDoubt(candidate.id)}
                      style={{
                        display: 'flex',
                        gap: '10px',
                        padding: '8px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        alignItems: 'center',
                        transition: 'border-color 0.2s'
                      }}
                      className="media-card-hover"
                    >
                      <div style={{ width: '40px', height: '60px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, backgroundColor: 'var(--bg-tertiary)' }}>
                        <img
                          src={getImageUrl(candidate.poster_path, 'w92')}
                          alt={title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {title} {year && `(${year})`}
                        </span>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.3' }}>
                          {candidate.overview || 'Sem descrição.'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '10px' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ borderRadius: '20px', padding: '10px 16px', fontSize: '11.5px', fontWeight: '800', flex: 1 }}
                  onClick={handleSkipDoubt}
                >
                  Ignorar esta
                </button>
                <button 
                  className="btn btn-danger" 
                  style={{ borderRadius: '20px', padding: '10px 16px', fontSize: '11.5px', fontWeight: '800', flex: 1 }}
                  onClick={handleSkipRemainingDoubts}
                >
                  Ignorar restantes
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Semicolons and loader writes details */}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '25px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div className="tvtime-loader" />
              </div>
              <h4 style={{ marginBottom: '8px', fontSize: '15px' }}>A importar dados locais...</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.4' }}>
                A descarregar os cartazes, temporadas, episódios e a restaurar o teu histórico. Não feches esta janela.
              </p>

              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                <div 
                  style={{ height: '100%', backgroundColor: 'var(--yellow-brand)', width: `${(progress.current / progress.total) * 100}%`, transition: 'width 0.2s' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '800' }}>
                <span>{progress.current} de {progress.total} itens</span>
                <span>{Math.round((progress.current / progress.total) * 100)}%</span>
              </div>

              <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'inline-block', maxWidth: '280px' }}>
                <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {progress.itemName}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{progress.status}</p>
              </div>
            </div>
          )}

          {/* STEP 4: Complete */}
          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '15px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '54px', height: '54px', borderRadius: '50%', backgroundColor: 'rgba(0, 210, 141, 0.1)', color: 'var(--green-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={28} strokeWidth={2.5} />
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>Importação Concluída!</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.4' }}>
                  Conseguimos ler os ficheiros do TV Time e importar com sucesso as tuas estatísticas para o BeeTime.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  <span>📺 Séries Importadas:</span>
                  <span>{importCounts.shows} séries</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  <span>🎬 Filmes Importados:</span>
                  <span>{importCounts.movies} filmes</span>
                </div>
              </div>

              <button className="btn btn-primary" style={{ borderRadius: '24px', padding: '12px 24px', fontWeight: '900', fontSize: '12px', width: '100%' }} onClick={onClose}>Ir para o painel</button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
