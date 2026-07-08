import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { getMovieDetails, getImageUrl, getMovieCredits, getMovieRecommendations, getMovieVideos, getMovieWatchProviders } from '../tmdb';
import { ChevronLeft, Plus, Check, Star, Trash2, Calendar, Eye, HelpCircle, Settings, Play, MoreHorizontal, Clock, Users, ChevronRight } from 'lucide-react';

const REACTIONS = [
  { emoji: '😵', label: 'Chocado', value: 'shocked' },
  { emoji: '😤', label: 'Frustrado', value: 'angry' },
  { emoji: '😭', label: 'Triste', value: 'sad' },
  { emoji: '🤔', label: 'Reflexivo', value: 'thoughtful' },
  { emoji: '🥺', label: 'Comovido', value: 'moved' },
  { emoji: '😆', label: 'Entretido', value: 'happy' },
  { emoji: '😱', label: 'Assustado', value: 'scared' },
  { emoji: '😑', label: 'Entediado', value: 'bored' },
  { emoji: '😌', label: 'Compreensivo', value: 'moved_2' },
  { emoji: '🤩', label: 'Empolgado', value: 'excited' },
  { emoji: '😕', label: 'Confuso', value: 'confused' },
  { emoji: '😬', label: 'Tenso', value: 'tense' }
];

export default function MovieDetails({ movieId, onBack, onNavigateToShow, onNavigateToMovie }) {
  const [movie, setMovie] = useState(null);
  const [activeTab, setActiveTab] = useState('about'); // 'about' or 'more'
  const [loading, setLoading] = useState(true);
  const [savingMovie, setSavingMovie] = useState(false);

  // Cast, Recommendations, Trailer & Providers
  const [cast, setCast] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [trailerKey, setTrailerKey] = useState('');
  const [trailerDuration, setTrailerDuration] = useState('02:00');
  const [providers, setProviders] = useState([]);

  const loadMovieDetails = async () => {
    try {
      setLoading(true);
      // Check if we have this movie locally
      let localMovie = await db.movies.get(movieId);

      // If not cached locally, we download and save it on-the-fly!
      if (!localMovie) {
        setSavingMovie(true);
        const tmdbMovie = await getMovieDetails(movieId);
        
        const record = {
          id: tmdbMovie.id,
          title: tmdbMovie.title,
          poster_path: tmdbMovie.poster_path,
          backdrop_path: tmdbMovie.backdrop_path,
          release_date: tmdbMovie.release_date,
          overview: tmdbMovie.overview,
          runtime: tmdbMovie.runtime || 120,
          is_favorite: 0,
          watched: 0,
          is_watchlist: 0, 
          genres: (tmdbMovie.genres || []).map(g => g.name).join(', '),
          rating: 0,
          reaction: '',
          watched_at: null
        };

        await db.movies.put(record);
        localMovie = record;
        setSavingMovie(false);
      }

      setMovie(localMovie);

      // Fetch credits (cast)
      try {
        const credits = await getMovieCredits(movieId);
        if (credits && credits.cast) {
          setCast(credits.cast.slice(0, 10));
        }
      } catch (e) {
        console.warn('Erro ao obter elenco do filme:', e);
      }

      // Fetch recommendations
      try {
        const recs = await getMovieRecommendations(movieId);
        if (recs && recs.results) {
          setRecommendations(recs.results.slice(0, 10));
        }
      } catch (e) {
        console.warn('Erro ao obter recomendações do filme:', e);
      }

      // Fetch videos (trailers)
      try {
        const videos = await getMovieVideos(movieId);
        if (videos && videos.results) {
          const trailer = videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
          if (trailer) {
            setTrailerKey(trailer.key);
          }
        }
      } catch (e) {
        console.warn('Erro ao obter trailer do filme:', e);
      }

      // Fetch watch providers
      try {
        const provs = await getMovieWatchProviders(movieId);
        if (provs && provs.results) {
          const ptData = provs.results.PT || provs.results.BR || provs.results.US || Object.values(provs.results)[0];
          if (ptData) {
            const list = [];
            if (ptData.flatrate) list.push(...ptData.flatrate);
            if (ptData.buy) list.push(...ptData.buy);
            if (ptData.rent) list.push(...ptData.rent);
            
            // Remove duplicates
            const unique = [];
            const seen = new Set();
            for (const item of list) {
              if (!seen.has(item.provider_id)) {
                seen.add(item.provider_id);
                unique.push(item);
              }
            }
            setProviders(unique);
          }
        }
      } catch (e) {
        console.warn('Erro ao obter watch providers:', e);
      }

    } catch (err) {
      console.error('Erro ao carregar filme:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovieDetails();
  }, [movieId]);

  const handleToggleWatchlist = async () => {
    const nextWatchlist = movie.is_watchlist === 1 ? 0 : 1;
    await db.movies.update(movieId, { is_watchlist: nextWatchlist });
    setMovie({ ...movie, is_watchlist: nextWatchlist });
  };

  const handleToggleFavorite = async () => {
    const nextFav = movie.is_favorite === 1 ? 0 : 1;
    await db.movies.update(movieId, { is_favorite: nextFav });
    setMovie({ ...movie, is_favorite: nextFav });
  };

  const handleToggleWatched = async () => {
    const nextWatched = movie.watched === 1 ? 0 : 1;
    const watchedAt = nextWatched ? new Date().toISOString() : null;
    
    await db.movies.update(movieId, { 
      watched: nextWatched,
      watched_at: watchedAt
    });

    setMovie({ 
      ...movie, 
      watched: nextWatched,
      watched_at: watchedAt
    });
  };

  const handleSetRating = async (ratingValue) => {
    await db.movies.update(movieId, { rating: ratingValue });
    setMovie({ ...movie, rating: ratingValue });
  };

  const handleSetReaction = async (reactionValue) => {
    const nextReaction = movie.reaction === reactionValue ? '' : reactionValue;
    await db.movies.update(movieId, { reaction: nextReaction });
    setMovie({ ...movie, reaction: nextReaction });
  };

  const handleToggleWatchlistFromRecommendation = async (recMovieId, e) => {
    e.stopPropagation();
    const item = await db.movies.get(recMovieId);
    if (item) {
      const nextWatchlist = item.is_watchlist === 1 ? 0 : 1;
      await db.movies.update(recMovieId, { is_watchlist: nextWatchlist });
    } else {
      // Mock save to DB first
      const details = await getMovieDetails(recMovieId);
      await db.movies.put({
        id: details.id,
        title: details.title,
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,
        release_date: details.release_date,
        overview: details.overview,
        runtime: details.runtime || 120,
        is_favorite: 0,
        watched: 0,
        is_watchlist: 1,
        genres: (details.genres || []).map(g => g.name).join(', '),
        rating: 0,
        reaction: '',
        watched_at: null
      });
    }
    loadMovieDetails();
  };

  if (loading || savingMovie) {
    return (
      <div className="loader-container">
        <div className="tvtime-loader" />
        {savingMovie && <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>A carregar dados do filme do TMDB...</p>}
      </div>
    );
  }

  if (!movie) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Filme não encontrado.</p>
        <button onClick={onBack} style={{ marginTop: '12px', padding: '8px 16px', backgroundColor: 'var(--yellow-brand)', border: 'none', borderRadius: '20px', fontWeight: 'bold' }}>Voltar</button>
      </div>
    );
  }

  // Runtime conversion to hours & minutes
  const runtimeHrs = Math.floor(movie.runtime / 60);
  const runtimeMins = movie.runtime % 60;
  const runtimeString = `${runtimeHrs}h ${runtimeMins}min`;

  // Release/Watch Dates Formatted
  const releaseDateFormatted = movie.release_date ? new Date(movie.release_date).toLocaleDateString('pt-PT') : 'S/ Data';
  const watchDateFormatted = movie.watched_at ? new Date(movie.watched_at).toLocaleDateString('pt-PT') : 'Por ver';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-primary)', paddingBottom: '40px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Apple Color Emoji", sans-serif' }}>
      
      {/* Top Banner Area */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '240px',
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.8) 95%), url('${getImageUrl(movie.backdrop_path, 'w780')}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px 16px 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        {/* Back and More buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            onClick={onBack}
            style={{
              background: 'rgba(0, 0, 0, 0.5)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff'
            }}
          >
            <ChevronLeft size={22} />
          </button>
        </div>

        {/* Title and Subtitle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#fff', letterSpacing: '-0.5px' }}>{movie.title}</h1>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: '700' }}>
            {movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}min` : '2h'} • {movie.genres}
          </span>
        </div>
      </div>

      {/* Watched Info Bar (Calendar icon, Eye icon, Watched green circle check) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
            <Calendar size={16} style={{ color: 'var(--text-secondary)' }} />
            <span>{releaseDateFormatted}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
            <Eye size={16} style={{ color: 'var(--text-secondary)' }} />
            <span>{watchDateFormatted}</span>
          </div>
        </div>

        {/* Big Green Watched Checkmark */}
        <button 
          onClick={handleToggleWatched}
          style={{
            background: movie.watched === 1 ? 'var(--green-accent)' : 'var(--bg-tertiary)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: movie.watched === 1 ? '#fff' : 'var(--text-secondary)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <Check size={18} strokeWidth={3} />
        </button>
      </div>

      {/* Tabs Switcher (SOBRE vs MAIS) */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('about')}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '14px 0',
            fontSize: '13px',
            fontWeight: '900',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'about' ? '3.5px solid var(--text-primary)' : '3.5px solid transparent',
            color: activeTab === 'about' ? 'var(--text-primary)' : 'var(--text-secondary)',
            letterSpacing: '0.5px'
          }}
        >
          SOBRE
        </button>
        <button
          onClick={() => setActiveTab('more')}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '14px 0',
            fontSize: '13px',
            fontWeight: '900',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'more' ? '3.5px solid var(--text-primary)' : '3.5px solid transparent',
            color: activeTab === 'more' ? 'var(--text-primary)' : 'var(--text-secondary)',
            letterSpacing: '0.5px'
          }}
        >
          MAIS
        </button>
      </div>

      {/* Main Tab Content */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Watchlist toggle buttons */}
        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
          <button
            onClick={handleToggleWatchlist}
            style={{
              flex: 1,
              backgroundColor: movie.is_watchlist === 1 ? 'var(--bg-secondary)' : 'var(--yellow-brand)',
              color: movie.is_watchlist === 1 ? 'var(--text-primary)' : '#000',
              border: movie.is_watchlist === 1 ? '1.5px solid var(--border-color)' : 'none',
              borderRadius: '24px',
              padding: '12px',
              fontSize: '12px',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {movie.is_watchlist === 1 ? <Check size={16} /> : <Plus size={16} />}
            {movie.is_watchlist === 1 ? 'ADICIONADO À WATCHLIST' : 'ADICIONAR À WATCHLIST'}
          </button>

          <button
            onClick={handleToggleFavorite}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: movie.is_favorite === 1 ? 'var(--yellow-brand)' : 'var(--text-primary)',
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Star size={18} fill={movie.is_favorite === 1 ? 'var(--yellow-brand)' : 'none'} />
          </button>
        </div>

        {activeTab === 'about' ? (
          /* SOBRE TAB */
          <>
            {/* Onde Ver section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-primary)' }}>Onde ver</h4>
              
              {providers.length > 0 ? (
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {providers.map(prov => (
                    <div key={prov.provider_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '70px', flexShrink: 0 }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <img src={getImageUrl(prov.logo_path, 'w92')} alt={prov.provider_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-secondary)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{prov.provider_name.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Não disponível</span>
              )}
            </div>

            {/* Informações sobre o filme */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-primary)' }}>Informações sobre o filme</h4>
              
              {/* Stars and Rating */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: 'var(--yellow-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '900', color: '#000' }}>T</div>
                <div style={{ display: 'flex', gap: '1px' }}>
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={14} fill={s <= 4 ? 'var(--yellow-brand)' : 'none'} color="var(--yellow-brand)" />
                  ))}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '800' }}>{movie.vote_average ? (movie.vote_average/2).toFixed(1) : '4.3'}/5 • 108 mil avaliações</span>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', lineHeight: '1.5' }}>
                {movie.overview || 'Sem sinopse disponível.'}
              </p>
            </div>

            {/* Ver Trailer Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{
                display: 'flex',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '10px',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer'
              }}
              onClick={() => {
                if (trailerKey) {
                  window.open(`https://www.youtube.com/watch?v=${trailerKey}`, '_blank');
                } else {
                  alert('Trailer não disponível.');
                }
              }}
              >
                <div style={{
                  width: '80px',
                  height: '50px',
                  borderRadius: '6px',
                  backgroundColor: '#000',
                  backgroundImage: `url('https://img.youtube.com/vi/${trailerKey || 'dQw4w9WgXcQ'}/hqdefault.jpg')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  flexShrink: 0
                }}>
                  <Play size={18} fill="#fff" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-primary)' }}>Ver trailer</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '800' }}>{trailerDuration}</span>
                </div>
              </div>
            </div>

            {/* Popular count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', paddingBottom: '16px' }}>
              <Users size={18} style={{ color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>3,69 M adicionou este filme</span>
            </div>

            {/* Cast (Elenco) */}
            {cast.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-primary)' }}>Elenco</h4>
                
                <div style={{
                  display: 'flex',
                  gap: '10px',
                  overflowX: 'auto',
                  paddingBottom: '6px',
                  margin: '0 -16px',
                  paddingLeft: '16px'
                }}>
                  {cast.map(actor => (
                    <div
                      key={actor.id}
                      style={{
                        width: '100px',
                        height: '140px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        position: 'relative',
                        flexShrink: 0,
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <img 
                        src={getImageUrl(actor.profile_path, 'w185')} 
                        alt={actor.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0) 100%)',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        minHeight: '60px'
                      }}>
                        <span style={{ fontSize: '10px', fontWeight: '900', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actor.name}</span>
                        <span style={{ fontSize: '7.5px', color: 'rgba(255,255,255,0.75)', fontWeight: '800', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actor.character}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-primary)' }}>As pessoas também viram</h4>
                
                <div style={{
                  display: 'flex',
                  gap: '10px',
                  overflowX: 'auto',
                  paddingBottom: '6px',
                  margin: '0 -16px',
                  paddingLeft: '16px'
                }}>
                  {recommendations.map(rec => (
                    <div
                      key={rec.id}
                      onClick={() => onNavigateToMovie(rec.id)}
                      style={{
                        width: '90px',
                        aspectRatio: '2/3',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        position: 'relative',
                        flexShrink: 0,
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer'
                      }}
                    >
                      <img 
                        src={getImageUrl(rec.poster_path, 'w185')} 
                        alt={rec.title} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      
                      <button
                        onClick={(e) => handleToggleWatchlistFromRecommendation(rec.id, e)}
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--yellow-brand)',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                          color: '#000'
                        }}
                      >
                        <Plus size={14} strokeWidth={3} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* MAIS (MORE) TAB */
          <>
            {/* ONDE VIU */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-secondary)', letterSpacing: '0.4px' }}>ONDE VIU?</h4>
              
              {providers.length > 0 ? (
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {providers.map(prov => (
                    <div key={prov.provider_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '70px', flexShrink: 0 }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <img src={getImageUrl(prov.logo_path, 'w92')} alt={prov.provider_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-secondary)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{prov.provider_name.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Não disponível</span>
              )}
            </div>

            {/* CLASSIFICAR ESTE FILME */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', alignItems: 'center' }}>
              <h4 style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-secondary)', letterSpacing: '0.4px' }}>CLASSIFICAR ESTE FILME</h4>
              
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', width: '100%' }}>
                {[1, 2, 3, 4, 5].map(starVal => {
                  const labels = ['RUIM', 'OK', 'BOM', 'ÓTIMO', 'UAU'];
                  const isGold = starVal <= movie.rating;
                  return (
                    <button
                      key={starVal}
                      onClick={() => handleSetRating(starVal)}
                      style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      <Star 
                        size={28} 
                        style={{ 
                          fill: isGold ? 'var(--yellow-brand)' : 'none', 
                          color: isGold ? 'var(--yellow-brand)' : 'var(--border-color)' 
                        }} 
                      />
                      <span style={{ fontSize: '8.5px', fontWeight: '900', color: isGold ? 'var(--yellow-brand)' : 'var(--text-secondary)' }}>{labels[starVal - 1]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* QUAL FOI A SENSAÇÃO? (iOS Emojis Grid!) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-secondary)', letterSpacing: '0.4px', textAlign: 'center' }}>QUAL FOI A SENSAÇÃO?</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {REACTIONS.map(rx => {
                  const isActive = movie.reaction === rx.value;
                  return (
                    <button
                      key={rx.value}
                      onClick={() => handleSetReaction(rx.value)}
                      style={{
                        background: isActive ? 'var(--yellow-bg-alpha)' : 'var(--bg-tertiary)',
                        border: `1.5px solid ${isActive ? 'var(--yellow-brand)' : 'var(--border-color)'}`,
                        borderRadius: '8px',
                        padding: '10px 4px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s'
                      }}
                    >
                      <span style={{ fontSize: '26px' }}>{rx.emoji}</span>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: isActive ? 'var(--yellow-brand)' : 'var(--text-primary)', textTransform: 'uppercase', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {rx.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* QUEM FOI O SEU FAVORITO */}
            {cast.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                <h4 style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-secondary)', letterSpacing: '0.4px', textAlign: 'center' }}>QUEM FOI O SEU FAVORITO?</h4>
                
                <div style={{
                  display: 'flex',
                  gap: '10px',
                  overflowX: 'auto',
                  paddingBottom: '4px',
                  margin: '0 -16px',
                  paddingLeft: '16px'
                }}>
                  {cast.map(actor => (
                    <div
                      key={actor.id}
                      style={{
                        width: '90px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        flexShrink: 0
                      }}
                    >
                      <div style={{
                        width: '70px',
                        height: '70px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '2px solid var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)'
                      }}>
                        <img src={getImageUrl(actor.profile_path, 'w185')} alt={actor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <span style={{ fontSize: '8.5px', fontWeight: '900', color: 'var(--text-primary)', textAlign: 'center', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{actor.character}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>

    </div>
  );
}
