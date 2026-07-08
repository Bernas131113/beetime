import React, { useState, useEffect } from 'react';
import { db, getWatchedEpisodesForShow, toggleEpisodeWatch } from '../db';
import { getImageUrl } from '../tmdb';
import { Check, Grid, List, Plus } from 'lucide-react';

export default function Series({ onNavigateToShow, onNavigateToDiscover }) {
  const [activeSubTab, setActiveSubTab] = useState('watchlist'); // 'watchlist' or 'upcoming'
  const [showFilter, setShowFilter] = useState('behind'); // 'behind', 'not-started', 'up-to-date'
  const [isGridView, setIsGridView] = useState(false);
  const [watchlistShows, setWatchlistShows] = useState([]);
  const [upcomingEpisodes, setUpcomingEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load Watchlist and Upcoming Data
  const loadData = async () => {
    try {
      setLoading(true);
      
      // 1. Load Watchlist Shows
      const showsList = await db.watchlist.toArray();
      const showItems = [];

      for (const item of showsList) {
        const show = await db.shows.get(item.show_id);
        if (!show) continue;

        const totalEps = await db.episodes.where('show_id').equals(show.id).toArray();
        const watchedEps = await getWatchedEpisodesForShow(show.id);
        const watchedIds = new Set(watchedEps.map(w => `${w.season_number}_${w.episode_number}`));

        const sortedEps = totalEps.sort((a, b) => {
          if (a.season_number !== b.season_number) return a.season_number - b.season_number;
          return a.episode_number - b.episode_number;
        });

        // Filter out specials (season 0)
        const regularEps = sortedEps.filter(e => e.season_number > 0);
        const nextEp = regularEps.find(e => !watchedIds.has(`${e.season_number}_${e.episode_number}`));
        
        const totalRegular = regularEps.length;
        const watchedRegular = regularEps.filter(e => watchedIds.has(`${e.season_number}_${e.episode_number}`)).length;
        const behindCount = totalRegular - watchedRegular;

        showItems.push({
          show,
          totalRegular,
          watchedRegular,
          behindCount,
          nextEp,
          addedAt: item.added_at
        });
      }

      // Sort shows: shows with next episodes first, then by behind count
      showItems.sort((a, b) => b.behindCount - a.behindCount || new Date(b.addedAt) - new Date(a.addedAt));
      setWatchlistShows(showItems);

      // 2. Load Upcoming Episodes (Calendar)
      const showIds = showsList.map(w => w.show_id);
      if (showIds.length > 0) {
        const allEpisodes = await db.episodes
          .where('show_id')
          .anyOf(showIds)
          .toArray();

        // Get date boundaries: from 3 days ago to 60 days in the future
        const minDate = new Date();
        minDate.setDate(minDate.getDate() - 3);
        const minDateStr = minDate.toISOString().split('T')[0];

        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 60);
        const maxDateStr = maxDate.toISOString().split('T')[0];

        const filteredEps = allEpisodes.filter(ep => {
          return ep.air_date && ep.air_date >= minDateStr && ep.air_date <= maxDateStr;
        });

        // Fetch show references
        const showsCache = {};
        for (const id of showIds) {
          showsCache[id] = await db.shows.get(id);
        }

        const mapped = filteredEps.map(ep => ({
          ...ep,
          show: showsCache[ep.show_id]
        }));

        // Check if episode is watched
        const watchedTable = await db.watched_episodes.toArray();
        const watchedSet = new Set(watchedTable.map(w => `${w.show_id}_${w.season_number}_${w.episode_number}`));

        // Group by air_date
        const grouped = {};
        mapped.forEach(ep => {
          const date = ep.air_date;
          if (!grouped[date]) {
            grouped[date] = [];
          }
          grouped[date].push({
            ...ep,
            watched: watchedSet.has(`${ep.show_id}_${ep.season_number}_${ep.episode_number}`)
          });
        });

        const sortedGroups = Object.keys(grouped)
          .sort((a, b) => a.localeCompare(b))
          .map(date => ({
            date,
            episodes: grouped[date]
          }));

        setUpcomingEpisodes(sortedGroups);
      } else {
        setUpcomingEpisodes([]);
      }

    } catch (err) {
      console.error('Erro ao carregar dados de séries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickWatch = async (showId, nextEp, e) => {
    e.stopPropagation();
    try {
      await toggleEpisodeWatch(showId, nextEp.season_number, nextEp.episode_number, true);
      await loadData();
    } catch (err) {
      console.error('Erro ao marcar episódio:', err);
    }
  };

  const handleQuickWatchCalendar = async (showId, seasonNum, epNum, e) => {
    e.stopPropagation();
    try {
      await toggleEpisodeWatch(showId, seasonNum, epNum, true);
      await loadData();
    } catch (err) {
      console.error('Erro ao marcar episódio a partir do calendário:', err);
    }
  };

  // Filter shows
  const filteredShows = watchlistShows.filter(item => {
    if (showFilter === 'behind') return item.behindCount > 0 && item.watchedRegular > 0;
    if (showFilter === 'not-started') return item.watchedRegular === 0;
    if (showFilter === 'up-to-date') return item.behindCount === 0 && item.totalRegular > 0;
    return true;
  });

  function formatDateHeader(dateStr) {
    const epDate = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0,0,0,0);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0,0,0,0);

    if (epDate.getTime() === today.getTime()) return 'HOJE';
    if (epDate.getTime() === tomorrow.getTime()) return 'AMANHÃ';
    if (epDate.getTime() === yesterday.getTime()) return 'ONTEM';

    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    return epDate.toLocaleDateString('pt-PT', options).toUpperCase();
  }

  // Check if an episode date is in the past
  const isAired = (airDate) => {
    if (!airDate) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    return airDate <= todayStr;
  };

  if (loading) {
    return (
      <div className="loader-container">
        <div className="tvtime-loader" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top TV Time Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-primary)',
        margin: '0 -16px',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button
          onClick={() => setActiveSubTab('watchlist')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            color: activeSubTab === 'watchlist' ? 'var(--text-primary)' : 'var(--text-secondary)',
            padding: '16px 0',
            fontSize: '13px',
            fontWeight: '900',
            cursor: 'pointer',
            borderBottom: activeSubTab === 'watchlist' ? '3px solid var(--text-primary)' : '3px solid transparent',
            letterSpacing: '0.5px'
          }}
        >
          LISTA PARA VER
        </button>
        <button
          onClick={() => setActiveSubTab('upcoming')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            color: activeSubTab === 'upcoming' ? 'var(--text-primary)' : 'var(--text-secondary)',
            padding: '16px 0',
            fontSize: '13px',
            fontWeight: '900',
            cursor: 'pointer',
            borderBottom: activeSubTab === 'upcoming' ? '3px solid var(--text-primary)' : '3px solid transparent',
            letterSpacing: '0.5px'
          }}
        >
          BREVEMENTE
        </button>
      </div>

      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
        {activeSubTab === 'watchlist' ? (
          /* Watchlist Sub-Tab */
          <>
            {/* Filter pills and grid toggle bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                <button
                  onClick={() => setShowFilter('behind')}
                  style={{
                    background: showFilter === 'behind' ? 'var(--yellow-brand)' : 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '6px 12px',
                    color: showFilter === 'behind' ? '#000000' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  EM ATRASO
                </button>
                <button
                  onClick={() => setShowFilter('not-started')}
                  style={{
                    background: showFilter === 'not-started' ? 'var(--yellow-brand)' : 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '6px 12px',
                    color: showFilter === 'not-started' ? '#000000' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  AINDA NÃO INICIADAS
                </button>
                <button
                  onClick={() => setShowFilter('up-to-date')}
                  style={{
                    background: showFilter === 'up-to-date' ? 'var(--yellow-brand)' : 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '6px 12px',
                    color: showFilter === 'up-to-date' ? '#000000' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  EM DIA
                </button>
              </div>

              {/* Grid toggle icon */}
              <button
                onClick={() => setIsGridView(!isGridView)}
                style={{
                  background: isGridView ? 'var(--yellow-brand)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: isGridView ? '#000' : 'var(--text-primary)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isGridView ? <Grid size={16} /> : <List size={16} />}
              </button>
            </div>

            {filteredShows.length === 0 ? (
              <div className="empty-state" style={{ marginTop: '20px' }}>
                <p className="empty-state-title">Sem séries nesta lista</p>
                <p className="empty-state-desc">Adiciona novas séries na aba "Explorar" para começar a acompanhar!</p>
              </div>
            ) : isGridView ? (
              /* Grid Mode (Posters Only) */
              <div className="grid-layout" style={{ marginTop: '10px' }}>
                {filteredShows.map(item => (
                  <div
                    key={item.show.id}
                    onClick={() => onNavigateToShow(item.show.id)}
                    style={{
                      borderRadius: '12px',
                      overflow: 'hidden',
                      aspectRatio: '2/3',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <img
                      src={getImageUrl(item.show.poster_path, 'w342')}
                      alt={item.show.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* List Mode (TV Time exact rows) */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                {filteredShows.map(item => (
                  <div
                    key={item.show.id}
                    className="watchlist-row"
                    onClick={() => onNavigateToShow(item.show.id)}
                    style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px' }}
                  >
                    <div className="row-poster-wrapper" style={{ width: '55px', height: '80px' }}>
                      <img
                        src={getImageUrl(item.show.poster_path, 'w92')}
                        alt={item.show.name}
                        className="row-poster"
                      />
                    </div>
                    <div className="row-details">
                      {/* Show title pill */}
                      <span style={{
                        alignSelf: 'flex-start',
                        border: '1.5px solid var(--text-primary)',
                        borderRadius: '12px',
                        padding: '1px 8px',
                        fontSize: '9.5px',
                        fontWeight: '900',
                        color: 'var(--text-primary)',
                        letterSpacing: '0.4px',
                        textTransform: 'uppercase',
                        marginBottom: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        {item.show.name} &gt;
                      </span>

                      {/* Episode details */}
                      {item.nextEp ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--text-primary)' }}>
                              T{item.nextEp.season_number.toString().padStart(2, '0')} | E{item.nextEp.episode_number.toString().padStart(2, '0')}
                            </span>
                            {item.behindCount > 1 && (
                              <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: '700' }}>
                                +{item.behindCount - 1}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.nextEp.name || `Episódio ${item.nextEp.episode_number}`}
                          </span>
                        </>
                      ) : (
                        <span style={{ fontSize: '12.5px', color: 'var(--green-accent)', fontWeight: '800', marginTop: '4px' }}>
                          Em dia com a série!
                        </span>
                      )}
                    </div>

                    {/* Quick watch circle */}
                    {item.nextEp && (
                      <button
                        onClick={(e) => handleQuickWatch(item.show.id, item.nextEp, e)}
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: 'var(--shadow-sm)',
                          flexShrink: 0,
                          color: 'var(--text-primary)'
                        }}
                      >
                        <Check size={20} strokeWidth={3} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Browse All Shows button */}
            <button
              onClick={onNavigateToDiscover}
              style={{
                background: 'none',
                border: '1.5px solid var(--text-primary)',
                borderRadius: '24px',
                padding: '12px 24px',
                color: 'var(--text-primary)',
                fontWeight: '900',
                fontSize: '12px',
                letterSpacing: '0.8px',
                cursor: 'pointer',
                textAlign: 'center',
                marginTop: '20px',
                width: '100%',
                marginBottom: '20px',
                transition: 'all 0.2s ease'
              }}
            >
              NAVEGAR POR TODAS AS SÉRIES
            </button>
          </>
        ) : (
          /* Upcoming/Calendar Sub-Tab */
          <>
            {upcomingEpisodes.length === 0 ? (
              <div className="empty-state" style={{ marginTop: '20px' }}>
                <p className="empty-state-title">Sem lançamentos próximos</p>
                <p className="empty-state-desc">Não há episódios novos programados para estrear nos próximos 60 dias.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px' }}>
                {upcomingEpisodes.map(group => (
                  <div key={group.date} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Day Pill Header */}
                    <div style={{ alignSelf: 'center', margin: '4px 0' }}>
                      <span style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '4px 12px',
                        fontSize: '9px',
                        fontWeight: '900',
                        color: 'var(--text-secondary)',
                        letterSpacing: '0.6px'
                      }}>
                        {formatDateHeader(group.date)}
                      </span>
                    </div>

                    {/* Day Episodes list */}
                    {group.episodes.map(ep => {
                      const aired = isAired(ep.air_date);
                      return (
                        <div
                          key={ep.id}
                          className="watchlist-row"
                          onClick={() => onNavigateToShow(ep.show_id)}
                          style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px', display: 'flex', alignItems: 'center' }}
                        >
                          <div className="row-poster-wrapper" style={{ width: '55px', height: '80px' }}>
                            <img
                              src={getImageUrl(ep.show?.poster_path, 'w92')}
                              alt={ep.show?.name}
                              className="row-poster"
                            />
                          </div>

                          <div className="row-details" style={{ flex: 1, minWidth: 0 }}>
                            {/* Show title pill */}
                            <span style={{
                              alignSelf: 'flex-start',
                              border: '1.5px solid var(--text-primary)',
                              borderRadius: '12px',
                              padding: '1px 8px',
                              fontSize: '9.5px',
                              fontWeight: '900',
                              color: 'var(--text-primary)',
                              letterSpacing: '0.4px',
                              textTransform: 'uppercase',
                              marginBottom: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}>
                              {ep.show?.name} &gt;
                            </span>

                            <div style={{ fontSize: '13px', fontWeight: '900', color: 'var(--text-primary)' }}>
                              T{ep.season_number.toString().padStart(2, '0')} | E{ep.episode_number.toString().padStart(2, '0')}
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ep.name || `Episódio ${ep.episode_number}`}
                            </span>

                            {/* Release badges */}
                            {aired && (
                              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                <span style={{ background: 'var(--yellow-brand)', color: '#000', fontSize: '9px', fontWeight: '900', padding: '1px 6px', borderRadius: '4px' }}>
                                  NOVO
                                </span>
                                <span style={{ background: 'var(--green-accent)', color: '#fff', fontSize: '9px', fontWeight: '900', padding: '1px 6px', borderRadius: '4px' }}>
                                  EXIBIDO
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Action Button: Checkmark or Network Info */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, paddingLeft: '8px' }}>
                            {aired ? (
                              !ep.watched ? (
                                <button
                                  onClick={(e) => handleQuickWatchCalendar(ep.show_id, ep.season_number, ep.episode_number, e)}
                                  style={{
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-color)',
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: 'var(--shadow-sm)',
                                    color: 'var(--text-primary)'
                                  }}
                                >
                                  <Check size={18} strokeWidth={3} />
                                </button>
                              ) : (
                                <span style={{ color: 'var(--green-accent)', fontSize: '11px', fontWeight: '800' }}>✓ Visto</span>
                              )
                            ) : (
                              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-primary)' }}>20:00</span>
                                <span style={{ fontSize: '8.5px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                  {ep.show?.status === 'Returning Series' ? 'TMDB' : 'ESTREIA'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
