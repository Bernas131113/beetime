import React, { useState, useEffect } from 'react';
import { db, saveShowToDB } from '../db';
import { searchMulti, getTrendingTV, getTrendingMovies, getTVDetails, getTVSeason, getImageUrl, getMovieDetails } from '../tmdb';
import { Search, Loader, Plus, Check, Play, Film, Tv, AlertTriangle } from 'lucide-react';

export default function Discover({ onNavigateToShow, onNavigateToMovie }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('feed'); // 'feed', 'discover', 'groups', 'activity'
  const [trendingTV, setTrendingTV] = useState([]);
  const [trendingMovies, setTrendingMovies] = useState([]);
  
  const [searching, setSearching] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [addingIds, setAddingIds] = useState(new Set()); // Tracks which IDs are being added
  const [trackedShowIds, setTrackedShowIds] = useState(new Set());
  const [trackedMovieIds, setTrackedMovieIds] = useState(new Set());
  const [error, setError] = useState(null);

  // Load tracked media & trends on mount
  const loadInitialData = async () => {
    try {
      setError(null);
      // Load tracked IDs
      const watchlist = await db.watchlist.toArray();
      setTrackedShowIds(new Set(watchlist.map(w => w.show_id)));
      
      const movies = await db.movies.where('is_watchlist').equals(1).toArray();
      setTrackedMovieIds(new Set(movies.map(m => m.id)));

      // Load trends
      const tvTrends = await getTrendingTV();
      const movieTrends = await getTrendingMovies();

      const tvList = tvTrends.results || [];
      const movieList = movieTrends.results || [];

      setTrendingTV(tvList.slice(0, 10));
      setTrendingMovies(movieList.slice(0, 10));

      // Combine into a single unified Feed (alternate TV and Movies)
      const combinedFeed = [];
      const maxLength = Math.max(tvList.length, movieList.length);
      for (let i = 0; i < Math.min(maxLength, 10); i++) {
        if (movieList[i]) {
          combinedFeed.push({ ...movieList[i], media_type: 'movie' });
        }
        if (tvList[i]) {
          combinedFeed.push({ ...tvList[i], media_type: 'tv' });
        }
      }
      setFeedItems(combinedFeed);

    } catch (err) {
      if (err.message === 'MISSING_API_KEY') {
        setError('Configure a sua Chave de API do TMDB nas Definições para pesquisar e descobrir séries/filmes.');
      } else {
        setError('Erro ao carregar tendências: ' + err.message);
      }
    } finally {
      setLoadingTrends(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setSearching(true);
      setError(null);
      const res = await searchMulti(query);
      const filtered = (res.results || []).filter(item => item.media_type === 'tv' || item.media_type === 'movie');
      setResults(filtered);
    } catch (err) {
      if (err.message === 'MISSING_API_KEY') {
        setError('Por favor, introduza uma chave de API TMDB válida nas Definições.');
      } else {
        setError('Erro na pesquisa: ' + err.message);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (!val.trim()) {
      setResults([]);
    }
  };

  const addShow = async (showSummary, e) => {
    e.stopPropagation();
    const showId = showSummary.id;

    if (trackedShowIds.has(showId)) {
      try {
        await db.watchlist.delete(showId);
        setTrackedShowIds(prev => {
          const n = new Set(prev);
          n.delete(showId);
          return n;
        });
      } catch (err) {
        console.error('Erro ao remover série da watchlist:', err);
      }
      return;
    }

    setAddingIds(prev => {
      const n = new Set(prev);
      n.add(showId);
      return n;
    });

    try {
      const showDetails = await getTVDetails(showId);
      const seasonsData = [];

      for (let i = 1; i <= showDetails.number_of_seasons; i++) {
        try {
          const seasonDetails = await getTVSeason(showId, i);
          seasonsData.push(seasonDetails);
        } catch (seasonErr) {
          console.warn(`Could not load season ${i} details:`, seasonErr);
        }
      }

      await saveShowToDB(showDetails, seasonsData);
      await db.watchlist.put({
        show_id: showId,
        added_at: new Date().toISOString(),
        is_archive: 0
      });

      setTrackedShowIds(prev => {
        const n = new Set(prev);
        n.add(showId);
        return n;
      });

    } catch (err) {
      console.error('Erro ao adicionar série:', err);
      alert('Não foi possível adicionar a série: ' + err.message);
    } finally {
      setAddingIds(prev => {
        const n = new Set(prev);
        n.delete(showId);
        return n;
      });
    }
  };

  const addMovie = async (movieSummary, e) => {
    e.stopPropagation();
    const movieId = movieSummary.id;

    if (trackedMovieIds.has(movieId)) {
      try {
        await db.movies.update(movieId, { is_watchlist: 0 });
        setTrackedMovieIds(prev => {
          const n = new Set(prev);
          n.delete(movieId);
          return n;
        });
      } catch (err) {
        console.error('Erro ao remover filme da watchlist:', err);
      }
      return;
    }

    setAddingIds(prev => {
      const n = new Set(prev);
      n.add(movieId);
      return n;
    });

    try {
      const movieDetails = await getMovieDetails(movieId);

      await db.movies.put({
        id: movieDetails.id,
        title: movieDetails.title,
        poster_path: movieDetails.poster_path,
        backdrop_path: movieDetails.backdrop_path,
        release_date: movieDetails.release_date,
        overview: movieDetails.overview,
        runtime: movieDetails.runtime || 120,
        is_favorite: 0,
        watched: 0,
        is_watchlist: 1,
        genres: (movieDetails.genres || []).map(g => g.name).join(', ')
      });

      setTrackedMovieIds(prev => {
        const n = new Set(prev);
        n.add(movieId);
        return n;
      });

    } catch (err) {
      console.error('Erro ao adicionar filme:', err);
      alert('Não foi possível adicionar o filme: ' + err.message);
    } finally {
      setAddingIds(prev => {
        const n = new Set(prev);
        n.delete(movieId);
        return n;
      });
    }
  };

  const handleCardClick = (item) => {
    const isShow = item.media_type === 'tv' || item.name;
    if (isShow) {
      onNavigateToShow(item.id);
    } else {
      onNavigateToMovie(item.id);
    }
  };

  if (loadingTrends) {
    return (
      <div className="loader-container">
        <div className="tvtime-loader" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '20px' }}>
      
      {/* Search input (TV Time clean style) */}
      <form onSubmit={handleSearchSubmit} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
          <Search size={18} style={{ color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            placeholder="Pesquisa" 
            value={query}
            onChange={handleInputChange}
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '15px',
              width: '100%',
              fontFamily: 'var(--font-sans)',
              fontWeight: '600'
            }}
          />
          {searching && <Loader className="animate-spin" size={16} style={{ color: 'var(--yellow-brand)' }} />}
        </div>
      </form>

      {error && (
        <div style={{ display: 'flex', gap: '12px', padding: '16px', background: 'rgba(255, 207, 0, 0.08)', color: 'var(--yellow-brand)', borderRadius: '16px', border: '1px solid var(--yellow-bg-alpha)', alignItems: 'center' }}>
          <AlertTriangle size={24} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '14px', fontWeight: '500' }}>{error}</span>
        </div>
      )}

      {/* Categories Horizontal Scrolling pills */}
      {!query && (
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', margin: '0 -16px', paddingLeft: '16px' }}>
          <button
            onClick={() => setActiveCategory('feed')}
            style={{
              backgroundColor: activeCategory === 'feed' ? 'var(--yellow-brand)' : '#1e2530',
              color: activeCategory === 'feed' ? '#000' : '#fff',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 18px',
              fontSize: '11px',
              fontWeight: '900',
              cursor: 'pointer',
              letterSpacing: '0.6px',
              whiteSpace: 'nowrap'
            }}
          >
            FEED
          </button>
          <button
            onClick={() => setActiveCategory('discover')}
            style={{
              backgroundColor: activeCategory === 'discover' ? 'var(--yellow-brand)' : '#1e2530',
              color: activeCategory === 'discover' ? '#000' : '#fff',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 18px',
              fontSize: '11px',
              fontWeight: '900',
              cursor: 'pointer',
              letterSpacing: '0.6px',
              whiteSpace: 'nowrap'
            }}
          >
            DESCOBRIR
          </button>
          <button
            onClick={() => setActiveCategory('groups')}
            style={{
              backgroundColor: activeCategory === 'groups' ? 'var(--yellow-brand)' : '#1e2530',
              color: activeCategory === 'groups' ? '#000' : '#fff',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 18px',
              fontSize: '11px',
              fontWeight: '900',
              cursor: 'pointer',
              letterSpacing: '0.6px',
              whiteSpace: 'nowrap'
            }}
          >
            GRUPOS
          </button>
          <button
            onClick={() => setActiveCategory('activity')}
            style={{
              backgroundColor: activeCategory === 'activity' ? 'var(--yellow-brand)' : '#1e2530',
              color: activeCategory === 'activity' ? '#000' : '#fff',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 18px',
              fontSize: '11px',
              fontWeight: '900',
              cursor: 'pointer',
              letterSpacing: '0.6px',
              whiteSpace: 'nowrap'
            }}
          >
            ATIVIDADE
          </button>
        </div>
      )}

      {/* Main content body conditional */}
      {query ? (
        /* Search Results List */
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            RESULTADOS DA PESQUISA
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {results.map(item => {
              const isShow = item.media_type === 'tv' || item.name;
              const isAdded = isShow ? trackedShowIds.has(item.id) : trackedMovieIds.has(item.id);
              const isAdding = addingIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className="watchlist-row"
                  onClick={() => handleCardClick(item)}
                  style={{ backgroundColor: '#000000', padding: '10px' }}
                >
                  <div className="row-poster-wrapper" style={{ width: '55px', height: '80px' }}>
                    <img
                      src={getImageUrl(item.poster_path, 'w92')}
                      alt={item.name || item.title}
                      className="row-poster"
                    />
                  </div>
                  <div className="row-details">
                    <span style={{
                      alignSelf: 'flex-start',
                      border: '1.5px solid #fff',
                      borderRadius: '12px',
                      padding: '1px 8px',
                      fontSize: '9px',
                      fontWeight: '900',
                      color: '#fff',
                      letterSpacing: '0.4px',
                      textTransform: 'uppercase',
                      marginBottom: '4px'
                    }}>
                      {isShow ? 'SÉRIE' : 'FILME'} &gt;
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '900', color: '#fff' }}>
                      {item.name || item.title}
                    </span>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      {item.first_air_date ? item.first_air_date.substring(0, 4) : item.release_date ? item.release_date.substring(0, 4) : 'N/A'}
                    </span>
                  </div>

                  <button
                    disabled={isAdding}
                    onClick={(e) => isShow ? addShow(item, e) : addMovie(item, e)}
                    style={{
                      background: isAdded ? 'transparent' : 'var(--yellow-brand)',
                      border: isAdded ? '1.5px solid var(--border-color)' : 'none',
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      color: isAdded ? 'var(--text-secondary)' : '#000'
                    }}
                  >
                    {isAdding ? <Loader className="animate-spin" size={16} /> : isAdded ? <Check size={18} /> : <Plus size={18} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeCategory === 'feed' ? (
        /* High fidelity TV Time Feed Cards (Alternate movies/shows) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px' }}>
          {feedItems.map(item => {
            const isShow = item.media_type === 'tv' || item.name;
            const isAdded = isShow ? trackedShowIds.has(item.id) : trackedMovieIds.has(item.id);
            const isAdding = addingIds.has(item.id);

            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item)}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer'
                }}
              >
                {/* Backdrop section */}
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
                  <img
                    src={getImageUrl(item.backdrop_path, 'w780')}
                    alt={item.name || item.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.7)' }}
                  />

                  {/* Add button top right */}
                  <button
                    disabled={isAdding}
                    onClick={(e) => isShow ? addShow(item, e) : addMovie(item, e)}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      border: '2px solid var(--yellow-brand)',
                      backgroundColor: 'transparent',
                      color: 'var(--yellow-brand)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 5
                    }}
                  >
                    {isAdding ? <Loader className="animate-spin" size={14} /> : isAdded ? <Check size={16} /> : <Plus size={16} />}
                  </button>

                  {/* Title and metadata Overlay */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '16px 12px 8px 12px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0) 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isShow ? <Tv size={14} style={{ color: '#fff' }} /> : <Film size={14} style={{ color: '#fff' }} />}
                      <span style={{ fontSize: '15px', fontWeight: '900', color: '#fff', letterSpacing: '-0.3px' }}>
                        {item.name || item.title}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {isShow ? 'Série' : 'Filme'} • {item.genre_ids ? 'Popular' : ''}
                    </span>
                  </div>

                  {/* Center Play Icon for movie visual fidelity */}
                  {!isShow && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(4px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1.5px solid #fff'
                    }}>
                      <Play size={20} fill="#fff" style={{ color: '#fff', marginLeft: '3px' }} />
                    </div>
                  )}
                </div>

                {/* Description bottom section */}
                <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-secondary)' }}>
                  <p style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.4',
                    display: '-webkit-box',
                    WebkitLineClamp: '2',
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {item.overview || 'Sem descrição disponível.'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Discover Sub-Tab (Traditional recommendations layout) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              SÉRIES POPULARES DA SEMANA
            </h3>
            <div className="grid-layout">
              {trendingTV.map(show => {
                const isAdded = trackedShowIds.has(show.id);
                const isAdding = addingIds.has(show.id);

                return (
                  <div key={show.id} className="media-card" onClick={() => onNavigateToShow(show.id)}>
                    <div className="card-image-wrapper">
                      <img 
                        className="card-image" 
                        src={getImageUrl(show.poster_path)} 
                        alt={show.name} 
                      />
                      <div className="card-overlay">
                        <button 
                          className="btn-primary"
                          style={{
                            border: 'none',
                            borderRadius: '8px',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            background: isAdded ? 'var(--bg-secondary)' : 'var(--yellow-brand)',
                            color: isAdded ? 'var(--text-secondary)' : '#000',
                            border: isAdded ? '1px solid var(--border-color)' : 'none'
                          }}
                          disabled={isAdding}
                          onClick={(e) => addShow(show, e)}
                        >
                          {isAdding ? <Loader className="animate-spin" size={10} /> : isAdded ? <Check size={12} /> : <Plus size={12} />}
                        </button>
                      </div>
                    </div>

                    <div className="card-info">
                      <span className="card-title">{show.name}</span>
                      <span className="card-meta">
                        <span>{show.first_air_date ? show.first_air_date.substring(0, 4) : 'N/A'}</span>
                        <span style={{ color: 'var(--yellow-brand)' }}>★ {show.vote_average?.toFixed(1)}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              FILMES POPULARES DA SEMANA
            </h3>
            <div className="grid-layout">
              {trendingMovies.map(movie => {
                const isAdded = trackedMovieIds.has(movie.id);
                const isAdding = addingIds.has(movie.id);

                return (
                  <div key={movie.id} className="media-card" onClick={() => onNavigateToMovie(movie.id)}>
                    <div className="card-image-wrapper">
                      <img 
                        className="card-image" 
                        src={getImageUrl(movie.poster_path)} 
                        alt={movie.title} 
                      />
                      <div className="card-overlay">
                        <button 
                          className="btn-primary"
                          style={{
                            border: 'none',
                            borderRadius: '8px',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            background: isAdded ? 'var(--bg-secondary)' : 'var(--yellow-brand)',
                            color: isAdded ? 'var(--text-secondary)' : '#000',
                            border: isAdded ? '1px solid var(--border-color)' : 'none'
                          }}
                          disabled={isAdding}
                          onClick={(e) => addMovie(movie, e)}
                        >
                          {isAdding ? <Loader className="animate-spin" size={10} /> : isAdded ? <Check size={12} /> : <Plus size={12} />}
                        </button>
                      </div>
                    </div>

                    <div className="card-info">
                      <span className="card-title">{movie.title}</span>
                      <span className="card-meta">
                        <span>{movie.release_date ? movie.release_date.substring(0, 4) : 'N/A'}</span>
                        <span style={{ color: 'var(--yellow-brand)' }}>★ {movie.vote_average?.toFixed(1)}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
