import React, { useState, useEffect } from 'react';
import { db, getSetting, setSetting } from './db';
import { getTVDetails, getMovieDetails } from './tmdb';
import Series from './components/Series';
import Filmes from './components/Filmes';
import Discover from './components/Discover';
import Profile from './components/Profile';
import ShowDetails from './components/ShowDetails';
import MovieDetails from './components/MovieDetails';
import Settings from './components/Settings';
import ImportWizard from './components/ImportWizard';
import Login from './components/Login';
import { Tv, Clapperboard, Search, User, AlertCircle } from 'lucide-react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('beetime_user_email'));
  const [activeTab, setActiveTab] = useState('series'); // series (default), filmes, explorar, perfil, settings, show-details, movie-details
  const [previousTab, setPreviousTab] = useState('series');
  const [selectedShowId, setSelectedShowId] = useState(null);
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  
  const [showCSVWizard, setShowCSVWizard] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('beetime_user_email');
    setIsAuthenticated(false);
  };

  // Background migration to update local DB titles to English
  useEffect(() => {
    if (!isAuthenticated) return;

    const migrateTitlesToEnglish = async () => {
      try {
        const migrated = await getSetting('english_titles_migrated_v2', 'false');
        if (migrated === 'true') return;

        console.log('BeeTime: Starting background English title migration...');

        // Migrate shows
        const localShows = await db.shows.toArray();
        for (const show of localShows) {
          try {
            const tmdbShow = await getTVDetails(show.id);
            if (tmdbShow && tmdbShow.name) {
              await db.shows.update(show.id, { name: tmdbShow.name });
            }
          } catch (e) {
            console.error(`Failed to migrate show ${show.id}:`, e);
          }
        }

        // Migrate movies
        const localMovies = await db.movies.toArray();
        for (const movie of localMovies) {
          try {
            const tmdbMovie = await getMovieDetails(movie.id);
            if (tmdbMovie && tmdbMovie.title) {
              await db.movies.update(movie.id, { title: tmdbMovie.title });
            }
          } catch (e) {
            console.error(`Failed to migrate movie ${movie.id}:`, e);
          }
        }

        await setSetting('english_titles_migrated_v2', 'true');
        console.log('BeeTime: English title migration finished.');
      } catch (err) {
        console.error('Error during title migration:', err);
      }
    };

    migrateTitlesToEnglish();
  }, [isAuthenticated]);

  const navigateToShow = (showId) => {
    setPreviousTab(activeTab);
    setSelectedShowId(showId);
    setActiveTab('show-details');
  };

  const navigateToMovie = (movieId) => {
    setPreviousTab(activeTab);
    setSelectedMovieId(movieId);
    setActiveTab('movie-details');
  };

  const handleBack = () => {
    setSelectedShowId(null);
    setSelectedMovieId(null);
    setActiveTab(previousTab);
  };

  // Detect native iOS swipe-to-back gesture with sliding animation
  useEffect(() => {
    const canGoBack = activeTab === 'show-details' || activeTab === 'movie-details' || activeTab === 'settings';
    if (!canGoBack) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let page = null;

    const handleTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      page = document.querySelector('.swipeable-page');
    };

    const handleTouchMove = (e) => {
      if (!page || touchStartX >= 45) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = currentX - touchStartX;
      const deltaY = Math.abs(currentY - touchStartY);

      // Only slide page if user is swiping right and not scrolling vertically
      if (deltaX > 0 && deltaY < deltaX) {
        page.style.transform = `translateX(${deltaX}px)`;
        page.style.transition = 'none';
      }
    };

    const handleTouchEnd = (e) => {
      if (!page || touchStartX >= 45) return;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const deltaX = touchEndX - touchStartX;
      const deltaY = Math.abs(touchEndY - touchStartY);

      if (deltaX > 100 && deltaY < deltaX) {
        // Complete swipe: slide page off-screen to the right
        page.style.transition = 'transform 0.24s cubic-bezier(0.1, 0.8, 0.3, 1)';
        page.style.transform = 'translateX(100%)';
        setTimeout(() => {
          handleBack();
          if (page) {
            page.style.transform = '';
            page.style.transition = '';
          }
        }, 220);
      } else {
        // Cancel swipe: slide back to origin
        page.style.transition = 'transform 0.2s cubic-bezier(0.1, 0.8, 0.3, 1)';
        page.style.transform = 'translateX(0px)';
        setTimeout(() => {
          if (page) {
            page.style.transform = '';
            page.style.transition = '';
          }
        }, 200);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeTab, previousTab]);

  const getDashboardTab = () => {
    const isDetail = activeTab === 'show-details' || activeTab === 'movie-details' || activeTab === 'settings';
    return isDetail ? previousTab : activeTab;
  };

  const renderContent = () => {
    const tabToRender = getDashboardTab();
    switch (tabToRender) {
      case 'series':
        return (
          <Series 
            onNavigateToShow={navigateToShow} 
            onNavigateToDiscover={() => { setPreviousTab('series'); setActiveTab('explorar'); }} 
          />
        );
      case 'filmes':
        return (
          <Filmes 
            onNavigateToMovie={navigateToMovie} 
            onNavigateToDiscover={() => { setPreviousTab('filmes'); setActiveTab('explorar'); }} 
          />
        );
      case 'explorar':
        return (
          <Discover 
            onNavigateToShow={navigateToShow} 
            onNavigateToMovie={navigateToMovie} 
          />
        );
      case 'perfil':
        return (
          <Profile 
            onNavigateToShow={navigateToShow} 
            onNavigateToMovie={navigateToMovie} 
            onOpenSettings={() => { setPreviousTab('perfil'); setActiveTab('settings'); }}
            onChangeTab={(tab) => { setPreviousTab('perfil'); setActiveTab(tab); }}
            onLogout={handleLogout}
          />
        );
      default:
        return (
          <Series 
            onNavigateToShow={navigateToShow} 
            onNavigateToDiscover={() => { setPreviousTab('series'); setActiveTab('explorar'); }} 
          />
        );
    }
  };

  const isActive = (tabName) => activeTab === tabName;

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const dashboardTab = getDashboardTab();
  const mainClass = dashboardTab === 'perfil' ? 'main-content-details' : 'main-content';

  return (
    <div className="app-container">
      {/* Main content body (Dashboard remains mounted underneath overlays) */}
      <main className={mainClass}>
        {renderContent()}
      </main>

      {/* Bottom Navigation Bar (TV Time Mobile Frame style) */}
      <div className="app-bottom-nav">
        <button 
          onClick={() => { setSelectedShowId(null); setSelectedMovieId(null); setActiveTab('series'); }} 
          className={`mobile-nav-link ${isActive('series') ? 'active' : ''}`}
        >
          <Tv size={20} />
          Séries
        </button>

        <button 
          onClick={() => { setSelectedShowId(null); setSelectedMovieId(null); setActiveTab('filmes'); }} 
          className={`mobile-nav-link ${isActive('filmes') ? 'active' : ''}`}
        >
          <Clapperboard size={20} />
          Filmes
        </button>

        <button 
          onClick={() => { setSelectedShowId(null); setSelectedMovieId(null); setActiveTab('explorar'); }} 
          className={`mobile-nav-link ${isActive('explorar') ? 'active' : ''}`}
        >
          <Search size={20} />
          Explorar
        </button>

        <button 
          onClick={() => { setSelectedShowId(null); setSelectedMovieId(null); setActiveTab('perfil'); }} 
          className={`mobile-nav-link ${isActive('perfil') || isActive('settings') ? 'active' : ''}`}
        >
          <User size={20} />
          Perfil
        </button>
      </div>

      {/* Detail/Settings Overlay Pages (absolutely positioned to allow swipe animations) */}
      {activeTab === 'settings' && (
        <div className="swipeable-page" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-primary)', zIndex: 150, overflowY: 'auto', padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px 40px 16px' }}>
          <button 
            onClick={handleBack} 
            className="btn btn-secondary" 
            style={{ marginBottom: '20px' }}
          >
            ← Voltar ao Perfil
          </button>
          <Settings onTriggerImportCSV={() => setShowCSVWizard(true)} onLogout={handleLogout} />
        </div>
      )}

      {activeTab === 'show-details' && (
        <div className="swipeable-page" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-primary)', zIndex: 150, overflowY: 'auto' }}>
          <ShowDetails 
            showId={selectedShowId} 
            onBack={handleBack} 
            onNavigateToShow={navigateToShow}
            onNavigateToMovie={navigateToMovie}
          />
        </div>
      )}

      {activeTab === 'movie-details' && (
        <div className="swipeable-page" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-primary)', zIndex: 150, overflowY: 'auto' }}>
          <MovieDetails 
            movieId={selectedMovieId} 
            onBack={handleBack} 
            onNavigateToShow={navigateToShow}
            onNavigateToMovie={navigateToMovie}
          />
        </div>
      )}

      {/* CSV Import Modal Wizard */}
      {showCSVWizard && (
        <ImportWizard 
          onImportComplete={(count) => {
            console.log(`Importadas ${count} séries.`);
          }} 
          onClose={() => {
            setShowCSVWizard(false);
            setActiveTab('perfil'); // Go back to profile to see updated stats
          }} 
        />
      )}
    </div>
  );
}

export default App;
