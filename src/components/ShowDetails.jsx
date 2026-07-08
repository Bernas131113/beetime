import React, { useState, useEffect } from 'react';
import { db, saveShowToDB, toggleEpisodeWatch, getWatchedEpisodesForShow, watchEntireSeason, unwatchEntireSeason } from '../db';
import { getTVDetails, getTVSeason, getImageUrl, getTVCredits, getTVRecommendations, getTVVideos, getTVWatchProviders } from '../tmdb';
import { ChevronLeft, Plus, Check, Star, Trash2, HelpCircle, Loader, Smile, Heart, Meh, Frown, ChevronDown, ChevronUp, Tv, Clock, Eye, MessageSquare, Play, HelpCircle as HelpIcon, Users } from 'lucide-react';

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

export default function ShowDetails({ showId, onBack, onNavigateToShow, onNavigateToMovie }) {
  const [show, setShow] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [activeTab, setActiveTab] = useState('about'); // 'about' or 'episodes'
  const [watchedEpisodes, setWatchedEpisodes] = useState([]); // Array of watched objects
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingShow, setSavingShow] = useState(false);
  
  // Cast, Recommendations, Trailers & Providers
  const [cast, setCast] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [trailerKey, setTrailerKey] = useState('');
  const [trailerDuration, setTrailerDuration] = useState('01:44');
  const [providers, setProviders] = useState([]);

  // Accordion seasons and their loaded episodes
  const [expandedSeasons, setExpandedSeasons] = useState({});
  const [seasonEpisodes, setSeasonEpisodes] = useState({});

  const watchedSet = new Set(watchedEpisodes.map(w => `${w.season_number}_${w.episode_number}`));

  const loadShowDetails = async () => {
    try {
      setLoading(true);
      // Check if we have this show locally
      let localShow = await db.shows.get(showId);
      let localSeasons = await db.seasons.where('show_id').equals(showId).toArray();

      // If not cached locally, we download and save it on-the-fly!
      if (!localShow || localSeasons.length === 0) {
        setSavingShow(true);
        const tmdbShow = await getTVDetails(showId);
        const seasonsDetails = [];
        
        for (let s = 1; s <= tmdbShow.number_of_seasons; s++) {
          try {
            const tmdbSeason = await getTVSeason(showId, s);
            seasonsDetails.push(tmdbSeason);
          } catch (e) {
            console.warn('Erro ao carregar temporada ' + s);
          }
        }

        await saveShowToDB(tmdbShow, seasonsDetails);
        localShow = await db.shows.get(showId);
        localSeasons = await db.seasons.where('show_id').equals(showId).toArray();
        setSavingShow(false);
      }

      setShow(localShow);
      
      // Sort seasons by season_number
      const sortedSeasons = localSeasons.sort((a, b) => a.season_number - b.season_number);
      setSeasons(sortedSeasons);

      // Check watchlist status
      const watchlist = await db.watchlist.get(showId);
      setIsWatchlisted(!!watchlist);

      // Load watched episodes
      const watched = await getWatchedEpisodesForShow(showId);
      setWatchedEpisodes(watched);

      // Fetch credits (cast)
      try {
        const credits = await getTVCredits(showId);
        if (credits && credits.cast) {
          setCast(credits.cast.slice(0, 10));
        }
      } catch (e) {
        console.warn('Erro ao obter elenco:', e);
      }

      // Fetch recommendations
      try {
        const recs = await getTVRecommendations(showId);
        if (recs && recs.results) {
          setRecommendations(recs.results.slice(0, 10));
        }
      } catch (e) {
        console.warn('Erro ao obter recomendações:', e);
      }

      // Fetch videos (trailers)
      try {
        const videos = await getTVVideos(showId);
        if (videos && videos.results) {
          const trailer = videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
          if (trailer) {
            setTrailerKey(trailer.key);
          }
        }
      } catch (e) {
        console.warn('Erro ao obter trailer:', e);
      }

      // Fetch watch providers
      try {
        const provs = await getTVWatchProviders(showId);
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

      // Pre-load the first season expanded by default in Episodes tab
      if (sortedSeasons.length > 0) {
        const firstSeason = sortedSeasons[0].season_number;
        setExpandedSeasons({ [firstSeason]: true });
        await loadEpisodesForSeason(showId, firstSeason);
      }

    } catch (err) {
      console.error('Erro ao carregar série:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShowDetails();
  }, [showId]);

  const loadEpisodesForSeason = async (sId, seasonNum) => {
    try {
      const eps = await db.episodes
        .where('show_id')
        .equals(sId)
        .filter(ep => ep.season_number === seasonNum)
        .toArray();
      
      const sorted = eps.sort((a, b) => a.episode_number - b.episode_number);
      setSeasonEpisodes(prev => ({
        ...prev,
        [seasonNum]: sorted
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSeasonExpand = async (seasonNum) => {
    const nextState = !expandedSeasons[seasonNum];
    setExpandedSeasons(prev => ({
      ...prev,
      [seasonNum]: nextState
    }));

    if (nextState && (!seasonEpisodes[seasonNum] || seasonEpisodes[seasonNum].length === 0)) {
      await loadEpisodesForSeason(show.id, seasonNum);
    }
  };

  const handleToggleWatchlist = async () => {
    if (isWatchlisted) {
      await db.watchlist.delete(show.id);
      setIsWatchlisted(false);
    } else {
      await db.watchlist.put({ show_id: show.id, added_at: Date.now() });
      setIsWatchlisted(true);
    }
  };

  const handleToggleFavorite = async () => {
    const nextFav = show.is_favorite === 1 ? 0 : 1;
    await db.shows.update(show.id, { is_favorite: nextFav });
    setShow({ ...show, is_favorite: nextFav });
  };

  const handleEpisodeCheck = async (seasonNum, episodeNum) => {
    const isWatched = watchedSet.has(`${seasonNum}_${episodeNum}`);
    await toggleEpisodeWatch(show.id, seasonNum, episodeNum, !isWatched);
    const watched = await getWatchedEpisodesForShow(show.id);
    setWatchedEpisodes(watched);
  };

  const handleSeasonCheckToggle = async (seasonNum, watchedCount, totalCount) => {
    if (watchedCount === totalCount) {
      // Unwatch all in season
      await unwatchEntireSeason(show.id, seasonNum);
    } else {
      // Watch all in season
      // Find episode numbers
      let eps = seasonEpisodes[seasonNum];
      if (!eps || eps.length === 0) {
        await loadEpisodesForSeason(show.id, seasonNum);
        eps = seasonEpisodes[seasonNum] || [];
      }
      const episodeNums = eps.map(e => e.episode_number);
      await watchEntireSeason(show.id, seasonNum, episodeNums);
    }
    const watched = await getWatchedEpisodesForShow(show.id);
    setWatchedEpisodes(watched);
  };

  const handleSetRating = async (watchedEpId, ratingValue) => {
    await db.watched_episodes.update(watchedEpId, { rating: ratingValue });
    const watched = await getWatchedEpisodesForShow(show.id);
    setWatchedEpisodes(watched);
  };

  const handleSetReaction = async (watchedEpId, reactionValue) => {
    const epRecord = watchedEpisodes.find(w => w.id === watchedEpId);
    const nextReaction = epRecord.reaction === reactionValue ? '' : reactionValue;
    await db.watched_episodes.update(watchedEpId, { reaction: nextReaction });
    const watched = await getWatchedEpisodesForShow(show.id);
    setWatchedEpisodes(watched);
  };

  const handleToggleWatchlistFromRecommendation = async (recShowId, e) => {
    e.stopPropagation();
    const isAdded = await db.watchlist.get(recShowId);
    if (isAdded) {
      await db.watchlist.delete(recShowId);
    } else {
      await db.watchlist.put({ show_id: recShowId, added_at: Date.now() });
    }
    // force reload of recommendation watchlist indicators
    loadShowDetails();
  };

  if (loading || savingShow) {
    return (
      <div className="loader-container">
        <div className="tvtime-loader" />
        {savingShow && <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>Carregando dados da série do TMDB...</p>}
      </div>
    );
  }

  if (!show) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Série não encontrada.</p>
        <button onClick={onBack} style={{ marginTop: '12px', padding: '8px 16px', backgroundColor: 'var(--yellow-brand)', border: 'none', borderRadius: '20px', fontWeight: 'bold' }}>Voltar</button>
      </div>
    );
  }

  const genresList = Array.isArray(show.genres) ? show.genres.map(g => typeof g === 'object' ? g.name : g) : [];
  const genresString = genresList.join(', ');

  const emissora = show.networks || 'TV';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-primary)', paddingBottom: '40px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Apple Color Emoji", sans-serif' }}>
      
      {/* Top Banner Area */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '240px',
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.8) 95%), url('${getImageUrl(show.backdrop_path, 'w780')}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '16px',
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

        {/* Title, Subtitle, and TV Time Yellow Rating Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: '900', color: '#fff', letterSpacing: '-0.5px' }}>{show.name}</h1>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: '700' }}>
              {show.number_of_seasons} temporadas • {emissora}
            </span>
          </div>

          {/* Yellow Rating Badge */}
          <div style={{
            backgroundColor: 'var(--yellow-brand)',
            borderRadius: '6px',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: '#000',
            fontWeight: '900',
            fontSize: '13px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            <span>T</span>
            <span>{show.vote_average ? Math.round(show.vote_average * 10) : 98}%</span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher (SOBRE vs EPISÓDIOS) */}
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
          onClick={() => setActiveTab('episodes')}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '14px 0',
            fontSize: '13px',
            fontWeight: '900',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'episodes' ? '3.5px solid var(--text-primary)' : '3.5px solid transparent',
            color: activeTab === 'episodes' ? 'var(--text-primary)' : 'var(--text-secondary)',
            letterSpacing: '0.5px'
          }}
        >
          EPISÓDIOS
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
              backgroundColor: isWatchlisted ? 'var(--bg-secondary)' : 'var(--yellow-brand)',
              color: isWatchlisted ? 'var(--text-primary)' : '#000',
              border: isWatchlisted ? '1.5px solid var(--border-color)' : 'none',
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
            {isWatchlisted ? <Check size={16} /> : <Plus size={16} />}
            {isWatchlisted ? 'A ACOMPANHAR' : 'ACOMPANHAR SÉRIE'}
          </button>

          <button
            onClick={handleToggleFavorite}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: show.is_favorite === 1 ? 'var(--yellow-brand)' : 'var(--text-primary)',
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Star size={18} fill={show.is_favorite === 1 ? 'var(--yellow-brand)' : 'none'} />
          </button>
        </div>

        {activeTab === 'about' ? (
          /* ABOUT TAB */
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

            {/* Popular Widget */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4caf50'
              }}>
                <Users size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--text-primary)' }}>Popular</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '800' }}>
                  {show.number_of_episodes ? `${(show.number_of_episodes * 8).toFixed(1)}M` : '3M'} adicionaram esta série
                </span>
              </div>
            </div>

            {/* Informações da série */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-primary)' }}>Informações da série</h4>
              
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>
                {show.first_air_date ? show.first_air_date.slice(0, 4) : '1999'} - {show.status === 'Ended' ? 'Terminado' : 'Presente'} • {genresString}
              </span>

              {/* Stars and Rating */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: 'var(--yellow-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '900', color: '#000' }}>T</div>
                <div style={{ display: 'flex', gap: '1px' }}>
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={14} fill={s <= 4 ? 'var(--yellow-brand)' : 'none'} color="var(--yellow-brand)" />
                  ))}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '800' }}>{show.vote_average ? (show.vote_average/2).toFixed(1) : '4.5'}/5</span>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', lineHeight: '1.5' }}>
                {show.overview || 'Sem sinopse disponível.'}
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

            {/* Extra Info Icons (Clock, Stopwatch, Users) */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '16px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                <Clock size={16} style={{ color: 'var(--text-secondary)' }} />
                <span>domingo | 23:15</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                <Tv size={16} style={{ color: 'var(--text-secondary)' }} />
                <span>{show.episode_run_time ? show.episode_run_time[0] || 45 : 45} min</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                <Users size={16} style={{ color: 'var(--text-secondary)' }} />
                <span>{show.number_of_episodes ? `${(show.number_of_episodes * 8).toFixed(1)}M` : '3M'} adicionaram esta série</span>
              </div>
            </div>

            {/* Cast (Elenco) Section */}
            {cast.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                      {/* Name overlay */}
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

            {/* Recommendations (As pessoas também viram) */}
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
                      onClick={() => onNavigateToShow(rec.id)}
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
                        src={getImageUrl(rec.poster_path, 'w92')} 
                        alt={rec.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      
                      {/* Watchlist Quick add "+" button on top right */}
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
          /* EPISODES TAB */
          <>
            {/* 1. Começar a acompanhar (Up Next scrolling slider) */}
            {seasons.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>Começar a acompanhar</h3>
                
                {/* Horizontal scrolling slider of next episodes */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  overflowX: 'auto',
                  paddingBottom: '6px',
                  margin: '0 -16px',
                  paddingLeft: '16px'
                }}>
                  {seasons.map(s => {
                    const eps = seasonEpisodes[s.season_number] || [];
                    const unwatched = eps.filter(ep => !watchedSet.has(`${s.season_number}_${ep.episode_number}`));
                    if (unwatched.length === 0) return null;

                    const ep = unwatched[0];
                    return (
                      <div
                        key={ep.id}
                        className="watchlist-row"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          width: '280px',
                          flexShrink: 0,
                          padding: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                      >
                        {/* Episode thumbnail */}
                        <div style={{ width: '80px', height: '54px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, backgroundColor: 'var(--bg-tertiary)' }}>
                          <img
                            src={getImageUrl(show.poster_path, 'w92')}
                            alt={ep.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>

                        {/* Episode detail texts */}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--text-primary)' }}>
                            T{ep.season_number.toString().padStart(2, '0')} | E{ep.episode_number.toString().padStart(2, '0')}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ep.name || `Episódio ${ep.episode_number}`}
                          </span>
                        </div>

                        {/* Quick watch button */}
                        <button
                          onClick={() => handleEpisodeCheck(ep.season_number, ep.episode_number)}
                          style={{
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)',
                            color: 'var(--text-primary)',
                            flexShrink: 0
                          }}
                        >
                          <Check size={18} strokeWidth={3} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Todos os episódios (Accordion seasons) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>Todos os episódios</h3>
                <Check size={18} style={{ color: 'var(--text-secondary)' }} />
              </div>

              {/* Season list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {seasons.map(s => {
                  const episodes = seasonEpisodes[s.season_number] || [];
                  const totalInSeason = s.episode_count || episodes.length || 10;
                  
                  // Calculate watched count for this season
                  const watchedInSeason = watchedEpisodes.filter(w => w.season_number === s.season_number).length;
                  const isExpanded = !!expandedSeasons[s.season_number];

                  return (
                    <div
                      key={s.id}
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1.5px solid var(--border-color)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      {/* Season Accordion Header */}
                      <div
                        onClick={() => toggleSeasonExpand(s.season_number)}
                        style={{
                          padding: '14px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          backgroundColor: 'var(--bg-tertiary)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--text-primary)' }}>
                            Temporada {s.season_number}
                          </span>
                          {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '800' }}>
                            {watchedInSeason}/{totalInSeason}
                          </span>

                          {/* Quick Watch Season circle */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSeasonCheckToggle(s.season_number, watchedInSeason, totalInSeason);
                            }}
                            style={{
                              background: watchedInSeason === totalInSeason ? 'var(--yellow-brand)' : 'var(--bg-tertiary)',
                              border: '1px solid var(--border-color)',
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: watchedInSeason === totalInSeason ? '#000' : 'var(--text-secondary)'
                            }}
                          >
                            <Check size={16} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>

                      {/* Season Accordion Content */}
                      {isExpanded && (
                        <div style={{ padding: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--bg-secondary)' }}>
                          {episodes.length === 0 ? (
                            <div className="loader-container" style={{ padding: '20px 0' }}>
                              <div className="tvtime-loader" style={{ width: '24px', height: '24px' }} />
                            </div>
                          ) : (
                            episodes.map(ep => {
                              const isEpWatched = watchedSet.has(`${s.season_number}_${ep.episode_number}`);
                              const watchObj = watchedEpisodes.find(w => w.season_number === s.season_number && w.episode_number === ep.episode_number);

                              return (
                                <div
                                  key={ep.id}
                                  style={{
                                    borderBottom: '1px solid var(--border-color)',
                                    paddingBottom: '10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                      {/* Ep number badge */}
                                      <div style={{
                                        width: '26px',
                                        height: '26px',
                                        borderRadius: '50%',
                                        backgroundColor: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--text-secondary)',
                                        fontSize: '11px',
                                        fontWeight: '900',
                                        flexShrink: 0
                                      }}>
                                        {ep.episode_number}
                                      </div>
                                      
                                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                        <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {ep.name || `Episódio ${ep.episode_number}`}
                                        </span>
                                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                          {ep.air_date ? new Date(ep.air_date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) : 'S/ Data'}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Ep checkmark circle */}
                                    <button
                                      onClick={() => handleEpisodeCheck(s.season_number, ep.episode_number)}
                                      style={{
                                        background: isEpWatched ? 'var(--yellow-brand)' : 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-color)',
                                        width: '30px',
                                        height: '30px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: isEpWatched ? '#000' : 'var(--text-secondary)',
                                        flexShrink: 0
                                      }}
                                    >
                                      <Check size={14} strokeWidth={2.5} />
                                    </button>
                                  </div>

                                  {/* Overview */}
                                  {ep.overview && (
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '36px', lineHeight: '1.4' }}>
                                      {ep.overview}
                                    </p>
                                  )}

                                  {/* Reaction Panel inside Checked Episodes */}
                                  {isEpWatched && watchObj && (
                                    <div style={{ paddingLeft: '36px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)' }}>Avaliação</span>
                                        
                                        {/* Stars rating */}
                                        <div style={{ display: 'flex', gap: '2px' }}>
                                          {[1, 2, 3, 4, 5].map(starVal => (
                                            <button 
                                              key={starVal}
                                              onClick={() => handleSetRating(watchObj.id, starVal)}
                                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                            >
                                              <Star 
                                                size={14} 
                                                style={{ 
                                                  fill: starVal <= (watchObj.rating || 0) ? 'var(--yellow-brand)' : 'none', 
                                                  color: starVal <= (watchObj.rating || 0) ? 'var(--yellow-brand)' : 'var(--text-muted)' 
                                                }} 
                                              />
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Reactions horizontal lists */}
                                      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                                        {REACTIONS.map(rx => (
                                          <button
                                            key={rx.value}
                                            onClick={() => handleSetReaction(watchObj.id, rx.value)}
                                            style={{
                                              background: watchObj.reaction === rx.value ? 'var(--yellow-bg-alpha)' : 'var(--bg-tertiary)',
                                              border: `1px solid ${watchObj.reaction === rx.value ? 'var(--yellow-brand)' : 'var(--border-color)'}`,
                                              borderRadius: '6px',
                                              padding: '4px 8px',
                                              fontSize: '11px',
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '3px'
                                            }}
                                          >
                                            <span>{rx.emoji}</span>
                                            <span style={{ fontSize: '8px', fontWeight: '900', color: watchObj.reaction === rx.value ? 'var(--yellow-brand)' : 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                              {rx.label}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
