import React, { useState, useEffect } from 'react';
import { db, getWatchStats } from '../db';
import { getImageUrl } from '../tmdb';
import { Film, Tv, Clock, Award, Star, List } from 'lucide-react';

export default function Dashboard({ onNavigateToShow, onNavigateToMovie }) {
  const [stats, setStats] = useState({
    totalShows: 0,
    totalEpisodes: 0,
    totalMovies: 0,
    totalMinutes: 0,
    tvMinutes: 0,
    movieMinutes: 0
  });
  const [favorites, setFavorites] = useState({ shows: [], movies: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const watchStats = await getWatchStats();
        setStats(watchStats);

        // Fetch favorite shows & movies
        const favShows = await db.shows.where('is_favorite').equals(1).limit(6).toArray();
        const favMovies = await db.movies.where('is_favorite').equals(1).limit(6).toArray();

        setFavorites({ shows: favShows, movies: favMovies });
      } catch (err) {
        console.error('Erro ao carregar estatísticas:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  // Convert minutes to Months, Days, Hours, Minutes (like TV Time)
  function formatWatchTime(totalMinutes) {
    const minutesInHour = 60;
    const minutesInDay = 24 * 60;
    const minutesInMonth = 30 * minutesInDay; // simplified month

    const months = Math.floor(totalMinutes / minutesInMonth);
    let remaining = totalMinutes % minutesInMonth;

    const days = Math.floor(remaining / minutesInDay);
    remaining = remaining % minutesInDay;

    const hours = Math.floor(remaining / minutesInHour);
    const minutes = remaining % minutesInHour;

    return { months, days, hours, minutes };
  }

  const { months, days, hours, minutes } = formatWatchTime(stats.totalMinutes);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--yellow-brand)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="stats-dashboard">
      <div>
        <h1 className="page-title">Olá! 👋</h1>
        <p className="page-subtitle">Aqui está o resumo do teu tempo de ecrã e atividade.</p>
      </div>

      {/* Watch Time Hero */}
      <div className="stats-hero">
        <div className="time-watched-container">
          <div className="time-watched-title">
            TEMPO DE VISUALIZAÇÃO
          </div>
          <div className="time-watched-grid">
            <div className="time-segment">
              <span className="time-val">{months}</span>
              <span className="time-lbl">Meses</span>
            </div>
            <div className="time-segment">
              <span className="time-val">{days}</span>
              <span className="time-lbl">Dias</span>
            </div>
            <div className="time-segment">
              <span className="time-val">{hours}</span>
              <span className="time-lbl">Horas</span>
            </div>
            <div className="time-segment">
              <span className="time-val">{minutes}</span>
              <span className="time-lbl">Minutos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Numerical Stats */}
      <div className="stats-numerical-card">
        <div className="stat-num-card">
          <span className="stat-num-val">{stats.totalShows}</span>
          <span className="stat-num-lbl">Séries</span>
        </div>
        <div className="stat-num-card">
          <span className="stat-num-val">{stats.totalEpisodes}</span>
          <span className="stat-num-lbl">Episódios</span>
        </div>
        <div className="stat-num-card">
          <span className="stat-num-val">{stats.totalMovies}</span>
          <span className="stat-num-lbl">Filmes</span>
        </div>
      </div>

      {/* Favorites Showcase */}
      <div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Star size={18} style={{ color: 'var(--yellow-brand)', fill: 'var(--yellow-brand)' }} />
          Séries Favoritas
        </h3>
        {favorites.shows.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px' }}>
            <p className="empty-state-title" style={{ fontSize: '15px' }}>Sem séries favoritas ainda</p>
            <p className="empty-state-desc">Podes marcar séries como favoritas nos detalhes da série.</p>
          </div>
        ) : (
          <div className="grid-layout">
            {favorites.shows.map(show => (
              <div 
                key={show.id} 
                className="media-card"
                onClick={() => onNavigateToShow(show.id)}
              >
                <div className="card-image-wrapper">
                  <img 
                    className="card-image" 
                    src={getImageUrl(show.poster_path)} 
                    alt={show.name} 
                  />
                  <div className="card-overlay">
                    <div className="card-badge badge-yellow">★ FAVORITA</div>
                  </div>
                </div>
                <div className="card-info">
                  <span className="card-title">{show.name}</span>
                  <span className="card-meta">
                    <span>{show.number_of_seasons} Temporadas</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', margin: '24px 0 18px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Star size={18} style={{ color: 'var(--yellow-brand)', fill: 'var(--yellow-brand)' }} />
          Filmes Favoritos
        </h3>
        {favorites.movies.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px' }}>
            <p className="empty-state-title" style={{ fontSize: '15px' }}>Sem filmes favoritos ainda</p>
            <p className="empty-state-desc">Podes adicionar filmes e marcá-los como favoritos na secção de descoberta.</p>
          </div>
        ) : (
          <div className="grid-layout">
            {favorites.movies.map(movie => (
              <div 
                key={movie.id} 
                className="media-card"
                onClick={() => onNavigateToMovie(movie.id)}
              >
                <div className="card-image-wrapper">
                  <img 
                    className="card-image" 
                    src={getImageUrl(movie.poster_path)} 
                    alt={movie.title} 
                  />
                  <div className="card-overlay">
                    <div className="card-badge badge-yellow">★ FAVORITO</div>
                  </div>
                </div>
                <div className="card-info">
                  <span className="card-title">{movie.title}</span>
                  <span className="card-meta">
                    <span>{movie.runtime} min</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
