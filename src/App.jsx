import React, { useState, useEffect } from 'react';
import { getSetting } from './db';
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

  const renderContent = () => {
    switch (activeTab) {
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
      case 'settings':
        return (
          <Settings 
            onTriggerImportCSV={() => setShowCSVWizard(true)} 
            onLogout={handleLogout}
          />
        );
      case 'show-details':
        return (
          <ShowDetails 
            showId={selectedShowId} 
            onBack={handleBack} 
            onNavigateToShow={navigateToShow}
            onNavigateToMovie={navigateToMovie}
          />
        );
      case 'movie-details':
        return (
          <MovieDetails 
            movieId={selectedMovieId} 
            onBack={handleBack} 
            onNavigateToShow={navigateToShow}
            onNavigateToMovie={navigateToMovie}
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

  return (
    <div className="app-container">
      {/* Main content body */}
      <main className={activeTab === 'show-details' || activeTab === 'movie-details' || activeTab === 'perfil' ? 'main-content-details' : 'main-content'}>


        {/* Back button overlay if in settings details */}
        {activeTab === 'settings' && (
          <button 
            onClick={handleBack} 
            className="btn btn-secondary" 
            style={{ marginBottom: '20px' }}
          >
            ← Voltar ao Perfil
          </button>
        )}

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

      {/* CSV Import Modal Wizard */}
      {showCSVWizard && (
        <ImportWizard 
          onImportComplete={(count) => {
            console.log(`Importadas ${count} séries.`);
          }} 
          onClose={() => {
            setShowCSVWizard(false);
            setActiveTab('profile'); // Go back to profile to see updated stats
          }} 
        />
      )}
    </div>
  );
}

export default App;
