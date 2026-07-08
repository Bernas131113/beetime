import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { getImageUrl } from '../tmdb';
import { Check, Grid, List } from 'lucide-react';

export default function Filmes({ onNavigateToMovie, onNavigateToDiscover }) {
  const [activeSubTab, setActiveSubTab] = useState('watchlist'); // 'watchlist' or 'upcoming'
  const [isGridView, setIsGridView] = useState(false);
  const [watchlistMovies, setWatchlistMovies] = useState([]);
  const [upcomingMovies, setUpcomingMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load Movies Watchlist (is_watchlist = 1 and watched = 0)
      const movies = await db.movies.where('is_watchlist').equals(1).toArray();
      const unwatched = movies.filter(m => m.watched !== 1);
      unwatched.sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''));
      setWatchlistMovies(unwatched);

      // Load Upcoming Movies (unwatched movies with future release dates)
      const todayStr = new Date().toISOString().split('T')[0];
      const upcoming = unwatched.filter(m => m.release_date && m.release_date > todayStr);
      setUpcomingMovies(upcoming);

    } catch (err) {
      console.error('Erro ao carregar dados de filmes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickWatch = async (movieId, e) => {
    e.stopPropagation();
    try {
      await db.movies.update(movieId, {
        watched: 1,
        watched_at: new Date().toISOString()
      });
      await loadData();
    } catch (err) {
      console.error('Erro ao marcar filme como visto:', err);
    }
  };

  // Popcorn SVG Illustration component matching the TV Time style
  const PopcornIllustration = () => (
    <div style={{ position: 'relative', width: '200px', height: '200px', margin: '0 auto' }}>
      <svg viewBox="0 0 200 200" width="100%" height="100%">
        {/* Colorful background sparkles */}
        <path d="M 30,80 L 35,85 L 30,90 L 25,85 Z" fill="#64dd17" />
        <path d="M 170,100 L 178,103 L 170,106 L 162,103 Z" fill="#ffab00" />
        <path d="M 50,150 L 53,155 L 48,160 L 43,155 Z" fill="#ff6d00" />
        <path d="M 150,50 L 153,53 L 148,58 L 143,53 Z" fill="#aa00ff" />
        
        {/* Green circle background */}
        <circle cx="100" cy="100" r="70" fill="#6bc839" stroke="#000" strokeWidth="4" />
        
        {/* Popcorn bucket body */}
        <path d="M 68,140 L 78,80 L 122,80 L 132,140 Z" fill="#fff" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
        
        {/* Red stripes */}
        <path d="M 78,140 L 85,80 L 93,80 L 88,140 Z" fill="#f44336" stroke="#000" strokeWidth="2" />
        <path d="M 96,140 L 98,80 L 102,80 L 104,140 Z" fill="#f44336" stroke="#000" strokeWidth="2" />
        <path d="M 112,140 L 115,80 L 122,80 L 118,140 Z" fill="#f44336" stroke="#000" strokeWidth="2" />

        {/* Fluffy popcorn kernels */}
        <circle cx="80" cy="72" r="14" fill="#ffe082" stroke="#000" strokeWidth="3" />
        <circle cx="95" cy="65" r="15" fill="#ffe082" stroke="#000" strokeWidth="3" />
        <circle cx="112" cy="70" r="14" fill="#ffe082" stroke="#000" strokeWidth="3" />
        <circle cx="100" cy="54" r="16" fill="#fff9c4" stroke="#000" strokeWidth="3" />
        <circle cx="86" cy="58" r="13" fill="#fff9c4" stroke="#000" strokeWidth="3" />
        <circle cx="114" cy="58" r="12" fill="#fff9c4" stroke="#000" strokeWidth="3" />

        {/* Little details on popcorn */}
        <path d="M 96,62 Q 99,65 97,68" stroke="#000" strokeWidth="2" fill="none" />
        <path d="M 80,72 Q 77,75 82,76" stroke="#000" strokeWidth="2" fill="none" />
        <path d="M 102,52 Q 105,50 101,48" stroke="#000" strokeWidth="2" fill="none" />
      </svg>
    </div>
  );

  if (loading) {
    return (
      <div className="loader-container">
        <div className="tvtime-loader" />
      </div>
    );
  }

  const currentList = activeSubTab === 'watchlist' ? watchlistMovies : upcomingMovies;

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
        {currentList.length === 0 ? (
          /* Empty Popcorn State (Matching screenshots exactly!) */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '20px', padding: '40px 10px', flex: 1 }}>
            <h2 style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)', maxHeight: '80px', maxWidth: '280px', lineHeight: '1.3' }}>
              {activeSubTab === 'watchlist' 
                ? 'A sua lista de visualização está vazia!' 
                : 'A sua lista "Brevemente" está vazia.'}
            </h2>
            
            <PopcornIllustration />

            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '700' }}>
              Adicione os filmes que quer ver.
            </p>

            <button
              onClick={onNavigateToDiscover}
              style={{
                backgroundColor: 'var(--yellow-brand)',
                color: '#000',
                border: 'none',
                borderRadius: '24px',
                padding: '14px 28px',
                fontWeight: '900',
                fontSize: '12px',
                letterSpacing: '0.8px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(255, 207, 0, 0.3)',
                width: '100%',
                maxWidth: '300px',
                marginTop: '10px',
                transition: 'all 0.2s ease'
              }}
            >
              NAVEGAR POR TODOS OS FILMES
            </button>
          </div>
        ) : (
          /* Movies List (If they actually add some) */
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
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
                  color: isGridView ? '#000' : 'var(--text-primary)'
                }}
              >
                {isGridView ? <Grid size={16} /> : <List size={16} />}
              </button>
            </div>

            {isGridView ? (
              <div className="grid-layout">
                {currentList.map(movie => (
                  <div
                    key={movie.id}
                    onClick={() => onNavigateToMovie(movie.id)}
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
                      src={getImageUrl(movie.poster_path, 'w342')}
                      alt={movie.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentList.map(movie => (
                  <div
                    key={movie.id}
                    className="watchlist-row"
                    onClick={() => onNavigateToMovie(movie.id)}
                    style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px' }}
                  >
                    <div className="row-poster-wrapper" style={{ width: '55px', height: '80px' }}>
                      <img
                        src={getImageUrl(movie.poster_path, 'w185')}
                        alt={movie.title}
                        className="row-poster"
                      />
                    </div>
                    <div className="row-details">
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
                        marginBottom: '4px'
                      }}>
                        FILME &gt;
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--text-primary)' }}>
                        {movie.title}
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        {movie.release_date ? movie.release_date.substring(0, 4) : 'N/A'} • {movie.genres || 'Cinema'}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleQuickWatch(movie.id, e)}
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
