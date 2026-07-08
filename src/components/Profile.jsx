import React, { useState, useEffect } from 'react';
import { db, getWatchStats } from '../db';
import { getImageUrl } from '../tmdb';
import { Bell, MoreHorizontal, User, ChevronRight, Plus, Tv, Star, ChevronLeft, Award, Film, Users, MessageSquare, Heart, X, Edit2, Trash2 } from 'lucide-react';

export default function Profile({ onNavigateToShow, onNavigateToMovie, onOpenSettings, onChangeTab, onLogout }) {
  const [stats, setStats] = useState({
    totalShows: 0,
    totalEpisodes: 0,
    totalMovies: 0,
    totalMinutes: 0,
    tvMinutes: 0,
    movieMinutes: 0
  });

  const [followedShows, setFollowedShows] = useState([]);
  const [followedMovies, setFollowedMovies] = useState([]);
  const [favoriteShows, setFavoriteShows] = useState([]);
  const [favoriteMovies, setFavoriteMovies] = useState([]);

  // Detailed watch records for stats pages
  const [watchedEps, setWatchedEps] = useState([]);
  const [watchedMovies, setWatchedMovies] = useState([]);

  // Advanced Stats computed dynamically
  const [advStats, setAdvStats] = useState({
    tvRemainingEps: 0,
    tvTimeToWatchAllHours: 0,
    tvRatedCount: 0,
    tvTopMarathons: [],
    tvAvgEpisodesPerWeek: '0.00',
    movieRemainingCount: 0,
    movieTimeToWatchAllHours: 0,
    movieRatedCount: 0,
    movieAvgPerWeek: '0.00'
  });

  // Profile data
  const [username, setUsername] = useState('109977035'); // Default matching screenshot username
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('Masculino');
  const [country, setCountry] = useState('');
  const [profilePic, setProfilePic] = useState('');
  const [coverPic, setCoverPic] = useState('https://image.tmdb.org/t/p/w780/kEl2Ly3C6SjZmgD37VqcxjKOZ7E.jpg'); // Frozen default backdrop
  
  const [loading, setLoading] = useState(true);

  // Main page stats view toggle (TV vs Movies)
  const [mainStatsType, setMainStatsType] = useState('series'); // 'series' | 'movies'

  // Stats Details Screen
  const [showStatsDetail, setShowStatsDetail] = useState(false);
  const [statsTab, setStatsTab] = useState('series'); // 'series' | 'filmes'
  const [selectedBadge, setSelectedBadge] = useState(null);

  // Carousel card pages in stats detail
  const [timeCardPage, setTimeCardPage] = useState(0); // 0: numbers, 1: chart
  const [countCardPage, setCountCardPage] = useState(0); // 0: numbers, 1: chart

  // Edit Profile Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBirth, setEditBirth] = useState('');
  const [editGender, setEditGender] = useState('Masculino');
  const [editCountry, setEditCountry] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editCover, setEditCover] = useState('');

  // Custom User Lists States
  const [customLists, setCustomLists] = useState([]);
  const [showListsOverlay, setShowListsOverlay] = useState(false);
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [activeListDetail, setActiveListDetail] = useState(null); // List object being viewed
  const [showEditListItemsModal, setShowEditListItemsModal] = useState(false);

  // Custom list creation inputs
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [selectedListItems, setSelectedListItems] = useState([]); // Array of { id, type: 'show'|'movie' }

  const loadProfile = async () => {
    try {
      setLoading(true);
      const watchStats = await getWatchStats();
      setStats(watchStats);

      // Load followed shows (with posters) for the horizontal scroll
      const watchlist = await db.watchlist.toArray();
      const list = [];
      for (const item of watchlist) {
        const show = await db.shows.get(item.show_id);
        if (show) list.push(show);
      }
      setFollowedShows(list);

      // Load all movies
      const allMovies = await db.movies.toArray();
      setFollowedMovies(allMovies.filter(m => m.is_watchlist === 1));
      setWatchedMovies(allMovies.filter(m => m.watched === 1));

      // Filter Favorites
      setFavoriteShows(list.filter(s => s.is_favorite === 1));
      setFavoriteMovies(allMovies.filter(m => m.is_favorite === 1));

      // Load watched episodes
      const eps = await db.watched_episodes.toArray();
      setWatchedEps(eps);

      // Load custom lists
      const lists = await db.lists.toArray();
      setCustomLists(lists);

      // Compute advanced stats
      let remainingEps = 0;
      let timeToWatchAllMins = 0;
      let ratedEpsCount = 0;
      const marathonMap = {};

      for (const show of list) {
        const showEps = eps.filter(e => e.show_id === show.id);
        const watchedCount = showEps.length;
        const totalEps = show.number_of_episodes || 0;
        const remaining = Math.max(0, totalEps - watchedCount);
        remainingEps += remaining;
        timeToWatchAllMins += remaining * (show.runtime || 45);

        if (watchedCount > 0) {
          marathonMap[show.name] = watchedCount;
        }
      }

      eps.forEach(e => {
        if (e.rating > 0) ratedEpsCount++;
      });

      const topMarathons = Object.entries(marathonMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count, hours: Math.round((count * 45) / 60) }));

      // Weeks calculation for avg
      let tvAvg = '0.00';
      if (eps.length > 0) {
        const dates = eps.map(e => new Date(e.watched_at).getTime()).filter(t => !isNaN(t));
        if (dates.length > 0) {
          const minDate = Math.min(...dates);
          const diffWeeks = Math.max(1, (Date.now() - minDate) / (7 * 24 * 60 * 60 * 1000));
          tvAvg = (eps.length / diffWeeks).toFixed(2);
        }
      }

      // Movie calculations
      const movieWatchlistRemaining = allMovies.filter(m => m.is_watchlist === 1 && m.watched === 0);
      const movieRemainingCount = movieWatchlistRemaining.length;
      const movieTimeToWatchAllHours = Math.round(movieWatchlistRemaining.reduce((acc, m) => acc + (m.runtime || 120), 0) / 60);
      const movieRatedCount = allMovies.filter(m => m.watched === 1 && m.rating > 0).length;

      let movieAvg = '0.00';
      const wMovies = allMovies.filter(m => m.watched === 1);
      if (wMovies.length > 0) {
        const dates = wMovies.map(m => m.watched_at ? new Date(m.watched_at).getTime() : Date.now()).filter(t => !isNaN(t));
        if (dates.length > 0) {
          const minDate = Math.min(...dates);
          const diffWeeks = Math.max(1, (Date.now() - minDate) / (7 * 24 * 60 * 60 * 1000));
          movieAvg = (wMovies.length / diffWeeks).toFixed(2);
        }
      }

      setAdvStats({
        tvRemainingEps: remainingEps,
        tvTimeToWatchAllHours: Math.round(timeToWatchAllMins / 60),
        tvRatedCount: ratedEpsCount,
        tvTopMarathons: topMarathons,
        tvAvgEpisodesPerWeek: tvAvg,
        movieRemainingCount,
        movieTimeToWatchAllHours,
        movieRatedCount,
        movieAvgPerWeek: movieAvg
      });

      // Load Profile Info from Settings
      const savedUsername = await db.settings.get('username');
      if (savedUsername) setUsername(savedUsername.value);
      
      const savedBirth = await db.settings.get('birthYear');
      if (savedBirth) setBirthYear(savedBirth.value);

      const savedGender = await db.settings.get('gender');
      if (savedGender) setGender(savedGender.value);

      const savedCountry = await db.settings.get('country');
      if (savedCountry) setCountry(savedCountry.value);

      const savedAvatar = await db.settings.get('profilePic');
      if (savedAvatar) setProfilePic(savedAvatar.value);

      const savedCover = await db.settings.get('coverPic');
      if (savedCover) setCoverPic(savedCover.value);

    } catch (err) {
      console.error('Erro ao carregar perfil:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // Trigger full edit profile modal
  const handleOpenEditModal = () => {
    setEditName(username);
    setEditBirth(birthYear);
    setEditGender(gender);
    setEditCountry(country);
    setEditAvatar(profilePic);
    setEditCover(coverPic);
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    await db.settings.put({ key: 'username', value: editName.trim() });
    await db.settings.put({ key: 'birthYear', value: editBirth.trim() });
    await db.settings.put({ key: 'gender', value: editGender });
    await db.settings.put({ key: 'country', value: editCountry.trim() });
    await db.settings.put({ key: 'profilePic', value: editAvatar });
    await db.settings.put({ key: 'coverPic', value: editCover });

    setUsername(editName.trim());
    setBirthYear(editBirth.trim());
    setGender(editGender);
    setCountry(editCountry.trim());
    setProfilePic(editAvatar);
    setCoverPic(editCover);

    setShowEditModal(false);
  };

  // Convert file to Base64 to save local uploads into Dexie Settings
  const handleImageUpload = (e, target) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (target === 'avatar') {
        setEditAvatar(reader.result);
      } else {
        setEditCover(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Lists management
  const handleCreateList = async () => {
    if (!newListName.trim()) return;

    await db.lists.add({
      name: newListName.trim(),
      description: newListDesc.trim(),
      items: selectedListItems
    });

    setNewListName('');
    setNewListDesc('');
    setSelectedListItems([]);
    setShowCreateListModal(false);
    
    // reload lists
    const lists = await db.lists.toArray();
    setCustomLists(lists);
  };

  const handleDeleteList = async (listId) => {
    if (!window.confirm('Tem a certeza de que deseja eliminar esta lista?')) return;
    await db.lists.delete(listId);
    setActiveListDetail(null);
    const lists = await db.lists.toArray();
    setCustomLists(lists);
  };

  const handleToggleItemInList = (id, type) => {
    const exists = selectedListItems.some(item => item.id === id && item.type === type);
    if (exists) {
      setSelectedListItems(prev => prev.filter(item => !(item.id === id && item.type === type)));
    } else {
      setSelectedListItems(prev => [...prev, { id, type }]);
    }
  };

  const handleOpenEditItems = () => {
    setSelectedListItems(activeListDetail.items || []);
    setShowEditListItemsModal(true);
  };

  const handleSaveListItems = async () => {
    const updatedList = { ...activeListDetail, items: selectedListItems };
    await db.lists.put(updatedList);
    setActiveListDetail(updatedList);
    setShowEditListItemsModal(false);

    // reload lists
    const lists = await db.lists.toArray();
    setCustomLists(lists);
  };

  // Helper to load details of items in a custom list
  const [resolvedListItems, setResolvedListItems] = useState([]);
  useEffect(() => {
    const resolveItems = async () => {
      if (!activeListDetail || !activeListDetail.items) {
        setResolvedListItems([]);
        return;
      }

      const list = [];
      for (const ref of activeListDetail.items) {
        if (ref.type === 'show') {
          const s = await db.shows.get(ref.id);
          if (s) list.push({ ...s, type: 'show' });
        } else {
          const m = await db.movies.get(ref.id);
          if (m) list.push({ ...m, type: 'movie' });
        }
      }
      setResolvedListItems(list);
    };

    resolveItems();
  }, [activeListDetail]);

  // Convert minutes to Months, Days, Hours object
  function formatWatchTime(totalMinutes) {
    const minutesInHour = 60;
    const minutesInDay = 24 * 60;
    const minutesInMonth = 30 * minutesInDay;

    const months = Math.floor(totalMinutes / minutesInMonth);
    let remaining = totalMinutes % minutesInMonth;

    const days = Math.floor(remaining / minutesInDay);
    remaining = remaining % minutesInDay;

    const hours = Math.floor(remaining / minutesInHour);
    return { months, days, hours };
  }

  // Calculate TV Show Stats
  const { months: tvMonths, days: tvDays, hours: tvHours } = formatWatchTime(stats.tvMinutes);
  
  // Calculate Movie Stats
  const { months: movieMonths, days: movieDays, hours: movieHours } = formatWatchTime(stats.movieMinutes);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // TV Recent Stats (7 days)
  const recentTvEps = watchedEps.filter(ep => ep.watched_at && new Date(ep.watched_at) >= sevenDaysAgo);
  const recentTvHours = Math.round((recentTvEps.length * 45) / 60);

  // Movie Recent Stats (7 days)
  const recentMovies = watchedMovies.filter(m => m.watched_at && new Date(m.watched_at) >= sevenDaysAgo);
  const recentMovieHours = Math.round(recentMovies.reduce((acc, m) => acc + (m.runtime || 120), 0) / 60);

  // Top Series Genres Calculation
  const getTopShowGenres = () => {
    const showGenres = {};
    followedShows.forEach(s => {
      const genresList = Array.isArray(s.genres) ? s.genres.map(g => typeof g === 'object' ? g.name : g) : [];
      genresList.forEach(g => {
        showGenres[g] = (showGenres[g] || 0) + 1;
      });
    });
    return Object.entries(showGenres).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };
  const topShowGenres = getTopShowGenres();

  // Top Show Networks Calculation
  const getTopShowNetworks = () => {
    const showNetworks = {};
    followedShows.forEach(s => {
      if (s.networks) {
        s.networks.split(',').forEach(n => {
          const name = n.trim();
          if (name) showNetworks[name] = (showNetworks[name] || 0) + 1;
        });
      }
    });
    return Object.entries(showNetworks).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };
  const topShowNetworks = getTopShowNetworks();

  // Top Movie Genres Calculation
  const getTopMovieGenres = () => {
    const movieGenres = {};
    followedMovies.forEach(m => {
      if (m.genres) {
        m.genres.split(',').forEach(g => {
          const name = g.trim();
          if (name) movieGenres[name] = (movieGenres[name] || 0) + 1;
        });
      }
    });
    return Object.entries(movieGenres).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };
  const topMovieGenres = getTopMovieGenres();

  // Badge list definitions (representing TV Time badges)
  const BADGES = [
    { id: 1, emoji: '🗣️', title: 'Serial Teller', desc: 'Desbloqueado ao escreveres o teu primeiro comentário nos episódios.', unlocked: stats.totalEpisodes > 0 },
    { id: 2, emoji: '📦', title: 'Archivist', desc: 'Desbloqueado ao arquivares pelo menos 1 série terminada.', unlocked: followedShows.length > 3 },
    { id: 3, emoji: '🏄‍♂️', title: 'Surfer', desc: 'Desbloqueado ao explorares e adicionares mais de 10 séries.', unlocked: followedShows.length >= 10 },
    { id: 4, emoji: '🏃‍♂️', title: 'Maratonista', desc: 'Desbloqueado ao veres mais de 3 episódios seguidos no mesmo dia.', unlocked: stats.totalEpisodes >= 10 },
    { id: 5, emoji: '⚖️', title: 'Jury Member', desc: 'Desbloqueado ao avaliares pelo menos 5 episódios com estrelas.', unlocked: stats.totalEpisodes > 4 },
    { id: 6, emoji: '🦉', title: 'Night Owl', desc: 'Desbloqueado ao registares visualizações de madrugada (00h-05h).', unlocked: stats.totalEpisodes > 0 },
    { id: 7, emoji: '🍿', title: 'Binge Watcher', desc: 'Desbloqueado ao veres uma temporada inteira de uma série num só dia.', unlocked: stats.totalEpisodes >= 8 },
    { id: 8, emoji: '🚀', title: 'Pioneer', desc: 'Desbloqueado ao assistires à estreia mundial de um episódio no BeeTime.', unlocked: followedShows.length > 0 },
    { id: 9, emoji: '✍️', title: 'Critic', desc: 'Desbloqueado ao submeteres reações e notas textuais.', unlocked: stats.totalEpisodes > 0 },
    { id: 10, emoji: '❤️', title: 'Lover', desc: 'Desbloqueado ao dares gostos em comentários ou reações de outros.', unlocked: true },
    { id: 11, emoji: '🗄️', title: 'Collector', desc: 'Desbloqueado ao teres mais de 50 séries na tua Watchlist.', unlocked: followedShows.length >= 50 },
    { id: 12, emoji: '🎞️', title: 'Cinephile', desc: 'Desbloqueado ao teres mais de 5 filmes vistos registados no perfil.', unlocked: watchedMovies.length >= 5 }
  ];
  const unlockedBadgesCount = BADGES.filter(b => b.unlocked).length;

  if (showStatsDetail) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', backgroundColor: 'var(--bg-primary)', margin: '0 -16px', paddingBottom: '30px' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', gap: '12px' }}>
          <button 
            onClick={() => { setShowStatsDetail(false); setSelectedBadge(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
          >
            <ChevronLeft size={24} />
          </button>
          <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>Estatísticas</span>
        </div>

        {/* Sticky tabs selector */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          <button
            onClick={() => { setStatsTab('series'); setSelectedBadge(null); }}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '14px 0',
              fontSize: '13px',
              fontWeight: '900',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderBottom: statsTab === 'series' ? '3.5px solid var(--text-primary)' : '3.5px solid transparent',
              color: statsTab === 'series' ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
          >
            SÉRIES
          </button>
          <button
            onClick={() => { setStatsTab('filmes'); setSelectedBadge(null); }}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '14px 0',
              fontSize: '13px',
              fontWeight: '900',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderBottom: statsTab === 'filmes' ? '3.5px solid var(--text-primary)' : '3.5px solid transparent',
              color: statsTab === 'filmes' ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
          >
            FILMES
          </button>
        </div>

        {/* Stats Content Body */}
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {statsTab === 'series' ? (
            /* SERIES STATS TAB */
            <>
              {/* 1. Time watched episodes card (Carousel pages!) */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-primary)' }}>Tempo gasto assistindo episódios</h4>
                
                {timeCardPage === 0 ? (
                  /* PAGE 0: Numerical Values (Matching Screenshot!) */
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', margin: '8px 0', alignItems: 'baseline' }}>
                    <div>
                      <span style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-primary)' }}>{tvMonths}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>meses</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-primary)' }}>{tvDays}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>dias</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-primary)' }}>{tvHours}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>horas</span>
                    </div>
                  </div>
                ) : (
                  /* PAGE 1: Weekly Hours Chart (TV Time Style!) */
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'center' }}>
                      {/* Vertical rotated HORAS label */}
                      <span style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', fontSize: '9px', fontWeight: '900', color: 'var(--text-secondary)', letterSpacing: '0.4px' }}>HORAS</span>
                      
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '65px', flex: 1, justifyContent: 'center', position: 'relative', borderBottom: '1px solid var(--border-color)' }}>
                        {[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, Math.min(8, Math.round(stats.tvMinutes/60))].map((h, i) => (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
                            <span style={{ fontSize: '8.5px', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '2px', position: 'absolute', bottom: `${Math.max(4, (h/8)*50) + 12}px` }}>{h}</span>
                            <div style={{ width: '100%', height: `${Math.max(4, (h/8)*50)}px`, backgroundColor: i === 11 ? 'var(--yellow-brand)' : 'var(--bg-tertiary)', borderRadius: '3px' }} />
                            <span style={{ fontSize: '8px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '700', position: 'absolute', top: '100%' }}>{17 + i}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: '900', color: 'var(--text-secondary)', marginTop: '16px' }}>POR SEMANA</span>
                  </div>
                )}

                {/* Page dots indicators */}
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', margin: '2px 0' }}>
                  <button onClick={() => setTimeCardPage(0)} style={{ width: '6px', height: '6px', borderRadius: '50%', border: 'none', backgroundColor: timeCardPage === 0 ? 'var(--yellow-brand)' : 'var(--border-color)', cursor: 'pointer', padding: 0 }} />
                  <button onClick={() => setTimeCardPage(1)} style={{ width: '6px', height: '6px', borderRadius: '50%', border: 'none', backgroundColor: timeCardPage === 1 ? 'var(--yellow-brand)' : 'var(--border-color)', cursor: 'pointer', padding: 0 }} />
                </div>

                <div style={{ fontSize: '10.5px', color: 'var(--text-primary)', fontWeight: '900', letterSpacing: '0.4px', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  {recentTvHours} HORAS NOS ÚLTIMOS 7 DIAS
                </div>

                <div style={{ color: '#0066cc', fontWeight: '900', fontSize: '12px', textAlign: 'center', cursor: 'pointer', paddingTop: '8px' }}>
                  COMPARE COM AS PESSOAS QUE SEGUE
                </div>
              </div>

              {/* 2. Total episodes watched card (Carousel pages!) */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-secondary)', textAlign: 'center' }}>Total de episódios assistidos</span>
                
                {countCardPage === 0 ? (
                  <span style={{ fontSize: '40px', fontWeight: '900', color: 'var(--text-primary)', margin: '4px 0' }}>{stats.totalEpisodes}</span>
                ) : (
                  /* Weekly Episodes Chart */
                  <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'center' }}>
                    <span style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', fontSize: '9px', fontWeight: '900', color: 'var(--text-secondary)', letterSpacing: '0.4px' }}>EPISÓDIOS</span>
                    
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '60px', flex: 1, justifyContent: 'center', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
                      {[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, Math.min(30, stats.totalEpisodes)].map((count, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                          <span style={{ fontSize: '8px', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '2px', position: 'absolute', bottom: `${Math.max(4, (count/30)*45) + 12}px` }}>{count}</span>
                          <div style={{ width: '100%', height: `${Math.max(4, (count/30)*45)}px`, backgroundColor: i === 11 ? 'var(--yellow-brand)' : 'var(--bg-tertiary)', borderRadius: '2px' }} />
                          <span style={{ fontSize: '8px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '700', position: 'absolute', top: '100%' }}>{17 + i}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', margin: '2px 0' }}>
                  <button onClick={() => setCountCardPage(0)} style={{ width: '6px', height: '6px', borderRadius: '50%', border: 'none', backgroundColor: countCardPage === 0 ? 'var(--yellow-brand)' : 'var(--border-color)', cursor: 'pointer', padding: 0 }} />
                  <button onClick={() => setCountCardPage(1)} style={{ width: '6px', height: '6px', borderRadius: '50%', border: 'none', backgroundColor: countCardPage === 1 ? 'var(--yellow-brand)' : 'var(--border-color)', cursor: 'pointer', padding: 0 }} />
                </div>

                <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: '900', letterSpacing: '0.4px', marginTop: '6px' }}>{recentTvEps.length} NOS ÚLTIMOS 7 DIAS</span>
              </div>

              {/* 3. Top Marathons */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-primary)' }}>Maiores maratonas</h4>
                {advStats.tvTopMarathons.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Sem maratonas registadas.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {advStats.tvTopMarathons.map((show, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{show.name}</span>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '700' }}>{show.count} episódios • {show.hours}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Series Added count */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-secondary)' }}>Séries adicionadas</span>
                <span style={{ fontSize: '40px', fontWeight: '900', color: 'var(--text-primary)', margin: '4px 0' }}>{followedShows.length}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '800' }}>{followedShows.filter(s => s.status === 'Returning Series').length} AINDA EM PRODUÇÃO</span>
              </div>

              {/* 5. Top Genres */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-primary)' }}>Principais géneros de séries</h4>
                
                {topShowGenres.length === 0 ? (
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Dados insuficientes.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {topShowGenres.map(([genre, count], idx) => {
                      const maxVal = topShowGenres[0][1];
                      const pct = Math.round((count / maxVal) * 100);
                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>
                            <span>{genre}</span>
                            <span>{count}</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--yellow-brand)', borderRadius: '3px' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 6. Top Networks */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-primary)' }}>Principais emissoras de séries</h4>
                
                {topShowNetworks.length === 0 ? (
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Dados insuficientes.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {topShowNetworks.map(([network, count], idx) => {
                      const maxVal = topShowNetworks[0][1];
                      const pct = Math.round((count / maxVal) * 100);
                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>
                            <span>{network}</span>
                            <span>{count}</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#4caf50', borderRadius: '3px' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 7. Rated stats */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-secondary)' }}>Avaliações votadas</span>
                <span style={{ fontSize: '40px', fontWeight: '900', color: 'var(--text-primary)', margin: '4px 0' }}>{advStats.tvRatedCount}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '800' }}>EM {followedShows.length} SÉRIES</span>
              </div>

              {/* 8. Remaining Episodes to watch */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-secondary)' }}>Episódios restantes</span>
                <span style={{ fontSize: '40px', fontWeight: '900', color: 'var(--text-primary)', margin: '4px 0' }}>{advStats.tvRemainingEps}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '800' }}>EM {followedShows.filter(s => s.number_of_episodes > 0).length} SÉRIES INICIADAS</span>
              </div>

              {/* 9. Upcoming Calendar */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-secondary)' }}>Próximos episódios futuros</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '60px', width: '220px', justifyContent: 'center', margin: '4px 0' }}>
                  {[2, 3, 1, 0, 4, 1, 2, 5, 3, 2, 4, 1].map((count, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{ width: '100%', height: `${Math.max(4, (count/5)*50)}px`, backgroundColor: i === 6 ? 'var(--yellow-brand)' : 'var(--bg-tertiary)', borderRadius: '2px' }} />
                      <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: '700' }}>
                        {['J','F','M','A','M','J','J','A','S','O','N','D'][i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 10. Binge Speed */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', fontWeight: '900', color: 'var(--text-secondary)', letterSpacing: '0.8px' }}>VELOCIDADE DE VISUALIZAÇÃO</span>
                <span style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-primary)', margin: '4px 0' }}>{advStats.tvAvgEpisodesPerWeek}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '800', textTransform: 'uppercase' }}>episódios/semana</span>
              </div>

              {/* 11. Time to watch all */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-secondary)' }}>Tempo para assistir tudo</span>
                <span style={{ fontSize: '40px', fontWeight: '900', color: 'var(--text-primary)', margin: '4px 0' }}>{advStats.tvTimeToWatchAllHours}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '800' }}>HORAS</span>
              </div>

              {/* 12. Badges block */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-primary)' }}>Crachás da aplicação ({unlockedBadgesCount})</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {BADGES.map(badge => (
                    <button
                      key={badge.id}
                      onClick={() => setSelectedBadge(badge)}
                      style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        opacity: badge.unlocked ? 1 : 0.25,
                        position: 'relative'
                      }}
                    >
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: selectedBadge?.id === badge.id ? '2px solid var(--yellow-brand)' : '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '22px',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        {badge.emoji}
                      </div>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: 'var(--text-secondary)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                        {badge.title}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Selected badge details */}
                {selectedBadge && (
                  <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '20px' }}>{selectedBadge.emoji}</span>
                      <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--text-primary)' }}>{selectedBadge.title}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: '900', padding: '2px 6px', borderRadius: '4px', backgroundColor: selectedBadge.unlocked ? 'rgba(0,210,141,0.1)' : 'rgba(0,0,0,0.05)', color: selectedBadge.unlocked ? 'var(--green-accent)' : 'var(--text-secondary)' }}>
                        {selectedBadge.unlocked ? 'CONCLUÍDO' : 'BLOQUEADO'}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{selectedBadge.desc}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* FILMES STATS TAB */
            <>
              {/* 1. Time watched movies card */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-primary)' }}>Tempo total assistindo filmes</h4>
                
                {timeCardPage === 0 ? (
                  /* Numerical (Matching Movie Screenshot!) */
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', margin: '8px 0', alignItems: 'baseline' }}>
                    <div>
                      <span style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-primary)' }}>{movieMonths}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>meses</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-primary)' }}>{movieDays}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>dias</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-primary)' }}>{movieHours}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>horas</span>
                    </div>
                  </div>
                ) : (
                  /* Weekly Chart Movies (Matching 8 hours bar screenshot!) */
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'center' }}>
                      <span style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', fontSize: '9px', fontWeight: '900', color: 'var(--text-secondary)', letterSpacing: '0.4px' }}>HORAS</span>
                      
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '65px', flex: 1, justifyContent: 'center', position: 'relative', borderBottom: '1px solid var(--border-color)' }}>
                        {[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, Math.min(8, Math.round(stats.movieMinutes/60))].map((h, i) => (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
                            <span style={{ fontSize: '8.5px', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '2px', position: 'absolute', bottom: `${Math.max(4, (h/8)*50) + 12}px` }}>{h > 0 ? h : ''}</span>
                            <div style={{ width: '100%', height: `${Math.max(4, (h/8)*50)}px`, backgroundColor: i === 11 ? 'var(--yellow-brand)' : 'var(--bg-tertiary)', borderRadius: '3px' }} />
                            <span style={{ fontSize: '8px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '700', position: 'absolute', top: '100%' }}>{17 + i}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: '900', color: 'var(--text-secondary)', marginTop: '16px' }}>POR SEMANA</span>
                  </div>
                )}

                {/* Page dots indicators */}
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', margin: '2px 0' }}>
                  <button onClick={() => setTimeCardPage(0)} style={{ width: '6px', height: '6px', borderRadius: '50%', border: 'none', backgroundColor: timeCardPage === 0 ? 'var(--yellow-brand)' : 'var(--border-color)', cursor: 'pointer', padding: 0 }} />
                  <button onClick={() => setTimeCardPage(1)} style={{ width: '6px', height: '6px', borderRadius: '50%', border: 'none', backgroundColor: timeCardPage === 1 ? 'var(--yellow-brand)' : 'var(--border-color)', cursor: 'pointer', padding: 0 }} />
                </div>

                <div style={{ fontSize: '10.5px', color: 'var(--text-primary)', fontWeight: '900', letterSpacing: '0.4px', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  {recentMovieHours} HORAS NOS ÚLTIMOS 7 DIAS
                </div>

                <div style={{ color: '#0066cc', fontWeight: '900', fontSize: '12px', textAlign: 'center', cursor: 'pointer', paddingTop: '8px' }}>
                  COMPARE COM AS PESSOAS QUE SEGUE
                </div>
              </div>

              {/* 2. Total movies watched card */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-secondary)' }}>Total de filmes assistidos</span>
                <span style={{ fontSize: '40px', fontWeight: '900', color: 'var(--text-primary)', margin: '4px 0' }}>{watchedMovies.length}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '900', letterSpacing: '0.4px' }}>{recentMovies.length} NOS ÚLTIMOS 7 DIAS</span>
              </div>

              {/* 3. Movies Added count */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-secondary)' }}>Adicionou filmes</span>
                <span style={{ fontSize: '40px', fontWeight: '900', color: 'var(--text-primary)', margin: '4px 0' }}>{followedMovies.length}</span>
              </div>

              {/* 4. Top Movie Genres */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-primary)' }}>Principais géneros de filmes</h4>
                
                {topMovieGenres.length === 0 ? (
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Dados insuficientes.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {topMovieGenres.map(([genre, count], idx) => {
                      const maxVal = topMovieGenres[0][1];
                      const pct = Math.round((count / maxVal) * 100);
                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>
                            <span>{genre}</span>
                            <span>{count}</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--yellow-brand)', borderRadius: '3px' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 5. Movies remaining */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-secondary)' }}>Filmes restantes</span>
                <span style={{ fontSize: '40px', fontWeight: '900', color: 'var(--text-primary)', margin: '4px 0' }}>{advStats.movieRemainingCount}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '800' }}>NA MINHA LISTA</span>
              </div>

              {/* 6. Movie Speed */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', fontWeight: '900', color: 'var(--text-secondary)', letterSpacing: '0.8px' }}>VELOCIDADE DE VISUALIZAÇÃO</span>
                <span style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-primary)', margin: '4px 0' }}>{advStats.movieAvgPerWeek}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '800', textTransform: 'uppercase' }}>filmes/semana</span>
              </div>

              {/* 7. Movie Rated Count */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-secondary)' }}>Avaliações votadas</span>
                <span style={{ fontSize: '40px', fontWeight: '900', color: 'var(--text-primary)', margin: '4px 0' }}>{advStats.movieRatedCount}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '800' }}>EM {watchedMovies.length} FILMES</span>
              </div>

              {/* 8. Time to watch all movies */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-secondary)' }}>Tempo para assistir tudo</span>
                <span style={{ fontSize: '40px', fontWeight: '900', color: 'var(--text-primary)', margin: '4px 0' }}>{advStats.movieTimeToWatchAllHours}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '800' }}>HORAS</span>
              </div>
            </>
          )}

        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', margin: '0 -16px', backgroundColor: 'var(--bg-primary)', paddingBottom: '20px' }}>
      
      {/* Profile Header Block with custom uploaded cover photo */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '220px',
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(10,12,20,1) 95%), url('${coverPic}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        {/* Top icons bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          {/* Yellow Bell Notification */}
          <button style={{
            background: 'var(--yellow-brand)',
            border: 'none',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            color: '#000'
          }}>
            <Bell size={18} fill="#000" />
          </button>

          {/* Settings Options (•••) */}
          <button 
            onClick={onOpenSettings}
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: 'none',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff'
            }}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>

        {/* User avatar and name info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
          {/* Avatar circle containing custom uploaded profile picture */}
          <div style={{
            width: '74px',
            height: '74px',
            borderRadius: '50%',
            backgroundColor: '#8e8e93',
            border: '3px solid #fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden'
          }}>
            {profilePic ? (
              <img src={profilePic} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <User size={44} />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '-0.3px' }}>{username}</h2>

            {/* EDITAR Button - Now opens the full TV Time edit screen! */}
            <button 
              onClick={handleOpenEditModal}
              style={{
                alignSelf: 'flex-start',
                backgroundColor: '#000000',
                border: '1.5px solid #fff',
                borderRadius: '12px',
                padding: '2px 12px',
                color: '#fff',
                fontSize: '9.5px',
                fontWeight: '900',
                letterSpacing: '0.4px',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              EDITAR
            </button>
          </div>
        </div>
      </div>

      {/* Numbers Stats Bar (a seguir / seguidores / comentários) */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '16px',
        margin: '0 16px'
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>{followedShows.length}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700' }}>a seguir</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>0</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700' }}>seguidores</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>0</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700' }}>comentários</span>
        </div>
      </div>

      {/* Estatísticas Section */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div 
          onClick={() => { setShowStatsDetail(true); setStatsTab(mainStatsType); }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <h3 style={{ fontSize: '17px', fontWeight: '900', color: 'var(--text-primary)' }}>Estatísticas</h3>
          <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />
        </div>

        {/* Side-by-side statistics boxes (Interactive: click to toggle between Series and Movies!) */}
        <div 
          onClick={() => setMainStatsType(prev => prev === 'series' ? 'movies' : 'series')}
          style={{ display: 'flex', gap: '10px', width: '100%', cursor: 'pointer' }}
          title="Clique para alternar entre Séries e Filmes"
        >
          {mainStatsType === 'series' ? (
            /* TV SHOWS MAIN STATS */
            <>
              {/* Horas a ver TV */}
              <div style={{
                flex: 1.2,
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1.5px solid var(--border-color)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px', fontSize: '11px', fontWeight: '900', color: 'var(--text-primary)' }}>
                  <Tv size={14} style={{ color: 'var(--text-secondary)' }} />
                  Horas a ver TV
                </div>
                <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)' }} />
                <div style={{ display: 'flex', padding: '12px 6px', textAlign: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>{tvMonths}</span>
                    <span style={{ fontSize: '8px', color: 'var(--text-secondary)', fontWeight: '800', marginTop: '2px' }}>MESES</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>{tvDays}</span>
                    <span style={{ fontSize: '8px', color: 'var(--text-secondary)', fontWeight: '800', marginTop: '2px' }}>DIAS</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>{tvHours}</span>
                    <span style={{ fontSize: '8px', color: 'var(--text-secondary)', fontWeight: '800', marginTop: '2px' }}>HORAS</span>
                  </div>
                </div>
              </div>

              {/* Episódios vistos */}
              <div style={{
                flex: 1,
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1.5px solid var(--border-color)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px', fontSize: '11px', fontWeight: '900', color: 'var(--text-primary)' }}>
                  <Tv size={14} style={{ color: 'var(--text-secondary)' }} />
                  Episódios vistos
                </div>
                <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '12px' }}>
                  <span style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' }}>{stats.totalEpisodes}</span>
                </div>
              </div>
            </>
          ) : (
            /* MOVIES MAIN STATS */
            <>
              {/* Horas a ver Filmes */}
              <div style={{
                flex: 1.2,
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1.5px solid var(--border-color)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px', fontSize: '11px', fontWeight: '900', color: 'var(--text-primary)' }}>
                  <Film size={14} style={{ color: 'var(--text-secondary)' }} />
                  Horas a ver filmes
                </div>
                <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)' }} />
                <div style={{ display: 'flex', padding: '12px 6px', textAlign: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>{movieMonths}</span>
                    <span style={{ fontSize: '8px', color: 'var(--text-secondary)', fontWeight: '800', marginTop: '2px' }}>MESES</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>{movieDays}</span>
                    <span style={{ fontSize: '8px', color: 'var(--text-secondary)', fontWeight: '800', marginTop: '2px' }}>DIAS</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>{movieHours}</span>
                    <span style={{ fontSize: '8px', color: 'var(--text-secondary)', fontWeight: '800', marginTop: '2px' }}>HORAS</span>
                  </div>
                </div>
              </div>

              {/* Filmes vistos */}
              <div style={{
                flex: 1,
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1.5px solid var(--border-color)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px', fontSize: '11px', fontWeight: '900', color: 'var(--text-primary)' }}>
                  <Film size={14} style={{ color: 'var(--text-secondary)' }} />
                  Filmes vistos
                </div>
                <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '12px' }}>
                  <span style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' }}>{watchedMovies.length}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Listas Section */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div 
          onClick={() => setShowListsOverlay(true)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <h3 style={{ fontSize: '17px', fontWeight: '900', color: 'var(--text-primary)' }}>Listas</h3>
          <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />
        </div>

        {customLists.length === 0 ? (
          /* Create list card */
          <div 
            onClick={() => setShowCreateListModal(true)}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '12px',
              border: '1.5px dashed var(--border-color)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <Plus size={24} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '0.4px' }}>CRIAR UMA NOVA LISTA</span>
          </div>
        ) : (
          /* Show custom lists scroll list */
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', margin: '0 -16px', paddingLeft: '16px', paddingBottom: '4px' }}>
            {customLists.map(list => (
              <div
                key={list.id}
                onClick={() => { setActiveListDetail(list); setShowListsOverlay(true); }}
                style={{
                  width: '140px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '12px',
                  flexShrink: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{list.name}</span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{(list.items || []).length} itens</span>
              </div>
            ))}
            {/* "+" Card inside the horizontal list */}
            <div 
              onClick={() => setShowCreateListModal(true)}
              style={{
                width: '100px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1.5px dashed var(--border-color)',
                borderRadius: '12px',
                flexShrink: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Plus size={20} style={{ color: 'var(--text-secondary)' }} />
            </div>
          </div>
        )}
      </div>

      {/* Séries followed section */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div 
          onClick={() => onChangeTab && onChangeTab('series')}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <h3 style={{ fontSize: '17px', fontWeight: '900', color: 'var(--text-primary)' }}>Séries</h3>
          <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />
        </div>

        {followedShows.length === 0 ? (
          <div style={{ padding: '20px 10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ainda não segues nenhuma série.</span>
          </div>
        ) : (
          /* Horizontal scrolling list of show posters */
          <div style={{
            display: 'flex',
            gap: '10px',
            overflowX: 'auto',
            paddingBottom: '4px',
            margin: '0 -16px',
            paddingLeft: '16px'
          }}>
            {followedShows.map(show => (
              <div
                key={show.id}
                onClick={() => onNavigateToShow(show.id)}
                style={{
                  width: '90px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  aspectRatio: '2/3',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-secondary)'
                }}
              >
                <img
                  src={getImageUrl(show.poster_path, 'w92')}
                  alt={show.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Séries Favoritas section */}
      {favoriteShows.length > 0 && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Heart size={16} fill="var(--red-accent)" style={{ color: 'var(--red-accent)' }} />
            <h3 style={{ fontSize: '17px', fontWeight: '900', color: 'var(--text-primary)' }}>Séries favoritas</h3>
          </div>

          <div style={{
            display: 'flex',
            gap: '10px',
            overflowX: 'auto',
            paddingBottom: '4px',
            margin: '0 -16px',
            paddingLeft: '16px'
          }}>
            {favoriteShows.map(show => (
              <div
                key={show.id}
                onClick={() => onNavigateToShow(show.id)}
                style={{
                  width: '90px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  aspectRatio: '2/3',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-secondary)'
                }}
              >
                <img
                  src={getImageUrl(show.poster_path, 'w92')}
                  alt={show.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filmes followed section */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div 
          onClick={() => onChangeTab && onChangeTab('filmes')}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <h3 style={{ fontSize: '17px', fontWeight: '900', color: 'var(--text-primary)' }}>Filmes</h3>
          <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />
        </div>

        {followedMovies.length === 0 ? (
          <div style={{ padding: '20px 10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ainda não adicionaste nenhum filme.</span>
          </div>
        ) : (
          /* Horizontal scrolling list of movie posters */
          <div style={{
            display: 'flex',
            gap: '10px',
            overflowX: 'auto',
            paddingBottom: '4px',
            margin: '0 -16px',
            paddingLeft: '16px'
          }}>
            {followedMovies.map(movie => (
              <div
                key={movie.id}
                onClick={() => onNavigateToMovie(movie.id)}
                style={{
                  width: '90px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  aspectRatio: '2/3',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-secondary)'
                }}
              >
                <img
                  src={getImageUrl(movie.poster_path, 'w92')}
                  alt={movie.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filmes Favoritos section */}
      {favoriteMovies.length > 0 && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Heart size={16} fill="var(--red-accent)" style={{ color: 'var(--red-accent)' }} />
            <h3 style={{ fontSize: '17px', fontWeight: '900', color: 'var(--text-primary)' }}>Filmes favoritas</h3>
          </div>

          <div style={{
            display: 'flex',
            gap: '10px',
            overflowX: 'auto',
            paddingBottom: '4px',
            margin: '0 -16px',
            paddingLeft: '16px'
          }}>
            {favoriteMovies.map(movie => (
              <div
                key={movie.id}
                onClick={() => onNavigateToMovie(movie.id)}
                style={{
                  width: '90px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  aspectRatio: '2/3',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-secondary)'
                }}
              >
                <img
                  src={getImageUrl(movie.poster_path, 'w92')}
                  alt={movie.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {showEditModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '440px', padding: 0, backgroundColor: 'var(--bg-primary)' }}>
            
            {/* Header bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                <X size={20} />
              </button>
              <span style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>Editar Perfil</span>
              <button 
                onClick={handleSaveProfile}
                style={{ background: 'none', border: 'none', color: '#0066cc', fontWeight: '900', fontSize: '14px', cursor: 'pointer', padding: 0 }}
              >
                SALVAR
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
              
              {/* Row 1: Escolher foto de perfil */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#8e8e93', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                  {editAvatar ? (
                    <img src={editAvatar} alt="avatar preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={30} />
                  )}
                </div>
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0066cc' }}>Escolher foto de perfil</span>
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'avatar')} style={{ display: 'none' }} />
              </label>

              {/* Row 2: Escolher foto de capa */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '8px', backgroundColor: '#0066cc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                  {editCover ? (
                    <img src={editCover} alt="cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.7)' }} />
                  ) : (
                    <Edit2 size={20} />
                  )}
                </div>
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0066cc' }}>Escolher foto de capa</span>
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'cover')} style={{ display: 'none' }} />
              </label>

              {/* Row 3: Nome de apresentação */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <label style={{ fontSize: '12px', fontWeight: '900', color: 'var(--text-secondary)' }}>Nome de apresentação</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ width: '100%', border: 'none', outline: 'none', color: '#0066cc', fontSize: '15px', fontWeight: '800', backgroundColor: 'transparent', padding: 0 }}
                />
              </div>

              {/* Section Header: Informações pessoais */}
              <div style={{ padding: '16px 16px 8px 16px', fontSize: '13px', fontWeight: '900', color: 'var(--text-primary)' }}>
                Informações pessoais
              </div>

              {/* Row 4: Ano de nascimento */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <label style={{ fontSize: '12px', fontWeight: '900', color: 'var(--text-secondary)' }}>Ano de nascimento</label>
                <input 
                  type="number" 
                  placeholder="-"
                  value={editBirth}
                  onChange={e => setEditBirth(e.target.value)}
                  style={{ width: '100%', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '15px', fontWeight: '800', backgroundColor: 'transparent', padding: 0 }}
                />
              </div>

              {/* Row 5: Género */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <label style={{ fontSize: '12px', fontWeight: '900', color: 'var(--text-secondary)' }}>Género</label>
                <select 
                  value={editGender}
                  onChange={e => setEditGender(e.target.value)}
                  style={{ width: '100%', border: 'none', outline: 'none', color: '#0066cc', fontSize: '15px', fontWeight: '800', backgroundColor: 'transparent', padding: 0 }}
                >
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              {/* Row 6: País */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <label style={{ fontSize: '12px', fontWeight: '900', color: 'var(--text-secondary)' }}>País</label>
                <input 
                  type="text" 
                  placeholder="-"
                  value={editCountry}
                  onChange={e => setEditCountry(e.target.value)}
                  style={{ width: '100%', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '15px', fontWeight: '800', backgroundColor: 'transparent', padding: 0 }}
                />
              </div>
              {/* Row 7: Terminar Sessão */}
              {onLogout && (
                <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
                  <button 
                    onClick={() => {
                      if (window.confirm('Deseja mesmo terminar a sua sessão?')) {
                        setShowEditModal(false);
                        onLogout();
                      }
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      border: '1.5px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '12px',
                      padding: '12px',
                      color: '#ef4444',
                      fontSize: '13px',
                      fontWeight: '900',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    TERMINAR SESSÃO (LOGOUT)
                  </button>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* CUSTOM LISTS OVERLAY SCREEN */}
      {showListsOverlay && (
        <div className="modal-overlay" style={{ zIndex: 900 }}>
          <div className="modal-content" style={{ maxWidth: '440px', padding: 0, minHeight: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', gap: '12px' }}>
              <button 
                onClick={() => { setShowListsOverlay(false); setActiveListDetail(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 0 }}
              >
                <ChevronLeft size={24} />
              </button>
              <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)', flex: 1 }}>
                {activeListDetail ? activeListDetail.name : 'Minhas Listas'}
              </span>

              {activeListDetail ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleOpenEditItems} style={{ background: 'none', border: 'none', color: '#0066cc', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}>EDITAR ITEMS</button>
                  <button onClick={() => handleDeleteList(activeListDetail.id)} style={{ background: 'none', border: 'none', color: 'var(--red-accent)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Trash2 size={16} /></button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowCreateListModal(true)} 
                  style={{ background: 'none', border: 'none', color: '#0066cc', fontWeight: '900', fontSize: '13px', cursor: 'pointer' }}
                >
                  CRIAR LISTA
                </button>
              )}
            </div>

            {/* List Detail View */}
            {activeListDetail ? (
              <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                {activeListDetail.description && (
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.4' }}>
                    {activeListDetail.description}
                  </p>
                )}
                
                {resolvedListItems.length === 0 ? (
                  <div style={{ padding: '40px 10px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Esta lista está vazia. Adicione séries ou filmes editando os itens!</span>
                  </div>
                ) : (
                  /* Grid of items in list */
                  <div className="grid-layout">
                    {resolvedListItems.map(item => (
                      <div
                        key={`${item.type}_${item.id}`}
                        onClick={() => {
                          setShowListsOverlay(false);
                          setActiveListDetail(null);
                          if (item.type === 'show') onNavigateToShow(item.id);
                          else onNavigateToMovie(item.id);
                        }}
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
                          src={getImageUrl(item.poster_path, 'w185')}
                          alt={item.name || item.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Lists List View */
              <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                {customLists.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 20px', gap: '20px', flex: 1 }}>
                    <h3 style={{ fontSize: '17px', fontWeight: '900', color: 'var(--text-primary)', lineHeight: '1.3' }}>Nenhuma lista para apresentar.</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.4' }}>
                      Crie listas para organizar e partilhar a sua coleção de séries e filmes.
                    </p>
                    <button 
                      onClick={() => setShowCreateListModal(true)}
                      style={{ backgroundColor: 'var(--yellow-brand)', color: '#000', border: 'none', borderRadius: '24px', padding: '12px 24px', fontWeight: '900', fontSize: '12px', cursor: 'pointer', width: '100%', maxWidth: '280px', marginTop: '10px' }}
                    >
                      CRIAR UMA NOVA LISTA →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {customLists.map(list => (
                      <div
                        key={list.id}
                        onClick={() => setActiveListDetail(list)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '16px',
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '14.5px', fontWeight: '900', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{list.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{list.description || 'Sem descrição.'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                          <span style={{ fontSize: '12px', fontWeight: '800' }}>{(list.items || []).length} itens</span>
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* CREATE NEW LIST MODAL */}
      {showCreateListModal && (
        <div className="modal-overlay" style={{ zIndex: 950 }}>
          <div className="modal-content" style={{ maxWidth: '440px', padding: 0, backgroundColor: 'var(--bg-primary)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <button onClick={() => setShowCreateListModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                <X size={20} />
              </button>
              <span style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>Nova Lista</span>
              <button 
                onClick={handleCreateList}
                disabled={!newListName.trim()}
                style={{ background: 'none', border: 'none', color: newListName.trim() ? '#0066cc' : 'var(--text-secondary)', fontWeight: '900', fontSize: '14px', cursor: newListName.trim() ? 'pointer' : 'default', padding: 0 }}
              >
                CRIAR
              </button>
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '450px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <label style={{ fontSize: '12px', fontWeight: '900', color: 'var(--text-secondary)' }}>Nome da lista</label>
                <input 
                  type="text" 
                  placeholder="Ex: Minhas Comédias Favoritas"
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  style={{ width: '100%', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '15px', fontWeight: '800', backgroundColor: 'transparent', padding: 0 }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <label style={{ fontSize: '12px', fontWeight: '900', color: 'var(--text-secondary)' }}>Descrição</label>
                <input 
                  type="text" 
                  placeholder="Descrição da lista..."
                  value={newListDesc}
                  onChange={e => setNewListDesc(e.target.value)}
                  style={{ width: '100%', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '14px', fontWeight: '700', backgroundColor: 'transparent', padding: 0 }}
                />
              </div>

              {/* Items checklist */}
              <div style={{ padding: '16px 16px 8px 16px', fontSize: '13px', fontWeight: '900', color: 'var(--text-primary)' }}>
                Adicionar séries e filmes à lista:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)' }}>
                {followedShows.map(show => {
                  const isChecked = selectedListItems.some(item => item.id === show.id && item.type === 'show');
                  return (
                    <div 
                      key={`show_${show.id}`} 
                      onClick={() => handleToggleItemInList(show.id, 'show')}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                    >
                      <input type="checkbox" checked={isChecked} readOnly style={{ cursor: 'pointer' }} />
                      <div style={{ width: '30px', height: '42px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'var(--bg-tertiary)' }}>
                        <img src={getImageUrl(show.poster_path, 'w92')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>{show.name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: '900', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>SÉRIE</span>
                    </div>
                  );
                })}

                {followedMovies.map(movie => {
                  const isChecked = selectedListItems.some(item => item.id === movie.id && item.type === 'movie');
                  return (
                    <div 
                      key={`movie_${movie.id}`} 
                      onClick={() => handleToggleItemInList(movie.id, 'movie')}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                    >
                      <input type="checkbox" checked={isChecked} readOnly style={{ cursor: 'pointer' }} />
                      <div style={{ width: '30px', height: '42px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'var(--bg-tertiary)' }}>
                        <img src={getImageUrl(movie.poster_path, 'w92')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>{movie.title}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: '900', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>FILME</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* EDIT ITEMS MODAL (For existing list) */}
      {showEditListItemsModal && activeListDetail && (
        <div className="modal-overlay" style={{ zIndex: 960 }}>
          <div className="modal-content" style={{ maxWidth: '440px', padding: 0, backgroundColor: 'var(--bg-primary)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <button onClick={() => setShowEditListItemsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                <X size={20} />
              </button>
              <span style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>Editar Itens da Lista</span>
              <button 
                onClick={handleSaveListItems}
                style={{ background: 'none', border: 'none', color: '#0066cc', fontWeight: '900', fontSize: '14px', cursor: 'pointer', padding: 0 }}
              >
                GRAVAR
              </button>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '400px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)' }}>
                {followedShows.map(show => {
                  const isChecked = selectedListItems.some(item => item.id === show.id && item.type === 'show');
                  return (
                    <div 
                      key={`edit_show_${show.id}`} 
                      onClick={() => handleToggleItemInList(show.id, 'show')}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                    >
                      <input type="checkbox" checked={isChecked} readOnly style={{ cursor: 'pointer' }} />
                      <div style={{ width: '30px', height: '42px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'var(--bg-tertiary)' }}>
                        <img src={getImageUrl(show.poster_path, 'w92')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>{show.name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: '900', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>SÉRIE</span>
                    </div>
                  );
                })}

                {followedMovies.map(movie => {
                  const isChecked = selectedListItems.some(item => item.id === movie.id && item.type === 'movie');
                  return (
                    <div 
                      key={`edit_movie_${movie.id}`} 
                      onClick={() => handleToggleItemInList(movie.id, 'movie')}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                    >
                      <input type="checkbox" checked={isChecked} readOnly style={{ cursor: 'pointer' }} />
                      <div style={{ width: '30px', height: '42px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'var(--bg-tertiary)' }}>
                        <img src={getImageUrl(movie.poster_path, 'w92')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>{movie.title}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: '900', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>FILME</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
