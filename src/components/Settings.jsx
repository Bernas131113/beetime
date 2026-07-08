import React, { useState, useEffect } from 'react';
import { db, getSetting, setSetting } from '../db';
import { testApiKey } from '../tmdb';
import { Key, Download, Upload, Trash2, Check, AlertCircle, HelpCircle, Eye, EyeOff } from 'lucide-react';

export default function Settings({ onTriggerImportCSV, onLogout }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState(null); // 'success', 'fail', null
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    async function loadKey() {
      const savedKey = await getSetting('tmdb_api_key', '');
      setApiKey(savedKey);
    }
    loadKey();
  }, []);

  const handleSaveKey = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const isValid = await testApiKey(apiKey.trim());
      if (isValid) {
        await setSetting('tmdb_api_key', apiKey.trim());
        setTestResult('success');
        showSuccessMessage('Chave de API guardada e validada com sucesso!');
      } else {
        setTestResult('fail');
      }
    } catch (err) {
      setTestResult('fail');
    } finally {
      setTesting(false);
    }
  };

  const showSuccessMessage = (text) => {
    setMsg({ type: 'success', text });
    setTimeout(() => setMsg(null), 4000);
  };

  const showErrorMessage = (text) => {
    setMsg({ type: 'error', text });
    setTimeout(() => setMsg(null), 4000);
  };

  // Export full IndexedDB as JSON backup
  const handleExportBackup = async () => {
    try {
      const backup = {
        shows: await db.shows.toArray(),
        seasons: await db.seasons.toArray(),
        episodes: await db.episodes.toArray(),
        watched_episodes: await db.watched_episodes.toArray(),
        movies: await db.movies.toArray(),
        watchlist: await db.watchlist.toArray(),
        settings: await db.settings.toArray()
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `beetime_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showSuccessMessage('Cópia de segurança (JSON) descarregada com sucesso!');
    } catch (err) {
      showErrorMessage('Falha ao exportar cópia de segurança: ' + err.message);
    }
  };

  // Import JSON backup
  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        
        // Basic validation
        if (!backup.shows || !backup.watched_episodes) {
          throw new Error('O ficheiro JSON selecionado não é um backup válido do BeeTime.');
        }

        // Restore in a transaction
        await db.transaction('rw', [db.shows, db.seasons, db.episodes, db.watched_episodes, db.movies, db.watchlist, db.settings], async () => {
          if (backup.shows.length > 0) await db.shows.bulkPut(backup.shows);
          if (backup.seasons && backup.seasons.length > 0) await db.seasons.bulkPut(backup.seasons);
          if (backup.episodes && backup.episodes.length > 0) await db.episodes.bulkPut(backup.episodes);
          if (backup.watched_episodes.length > 0) await db.watched_episodes.bulkPut(backup.watched_episodes);
          if (backup.movies && backup.movies.length > 0) await db.movies.bulkPut(backup.movies);
          if (backup.watchlist && backup.watchlist.length > 0) await db.watchlist.bulkPut(backup.watchlist);
          if (backup.settings && backup.settings.length > 0) await db.settings.bulkPut(backup.settings);
        });

        showSuccessMessage('Dados restaurados com sucesso! Recarregue a página para atualizar.');
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        showErrorMessage('Falha ao importar backup: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleClearDatabase = async () => {
    if (window.confirm('ATENÇÃO: Isto vai apagar permanentemente todas as tuas séries, filmes e histórico de visualizações local. Desejas continuar?')) {
      if (window.confirm('Confirmação final: Tens a certeza absoluta? Esta ação não pode ser desfeita.')) {
        try {
          await Promise.all([
            db.shows.clear(),
            db.seasons.clear(),
            db.episodes.clear(),
            db.watched_episodes.clear(),
            db.movies.clear(),
            db.watchlist.clear(),
            db.settings.clear()
          ]);
          showSuccessMessage('Base de dados limpa com sucesso!');
          setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
          showErrorMessage('Falha ao limpar base de dados: ' + err.message);
        }
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h1 className="page-title">Definições</h1>
        <p className="page-subtitle">Gere as tuas chaves de API, importação, exportação e dados locais.</p>
      </div>

      {msg && (
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          padding: '12px 16px', 
          background: msg.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
          color: msg.type === 'success' ? 'var(--green-accent)' : 'var(--red-accent)', 
          borderRadius: '12px', 
          fontSize: '14px', 
          fontWeight: '500',
          alignItems: 'center'
        }}>
          {msg.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* TMDB API Key Section */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Key size={20} style={{ color: 'var(--yellow-brand)' }} />
          Chave da API do TMDB
        </h3>
        
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
          O BeeTime é executado 100% no teu browser de forma offline. Para pesquisar e descarregar capas de séries e metadados, precisas de uma chave de API gratuita do <strong>The Movie Database (TMDB)</strong>.
        </p>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label">Chave de API (v3)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                type={showKey ? 'text' : 'password'} 
                className="form-input" 
                placeholder="Introduz a tua Chave de API v3..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{ paddingRight: '44px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowKey(!showKey)} 
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={handleSaveKey} 
              disabled={testing || !apiKey}
            >
              {testing ? 'A validar...' : 'Validar e Guardar'}
            </button>
          </div>
        </div>

        {testResult === 'success' && (
          <div style={{ color: 'var(--green-accent)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '-8px', marginBottom: '16px' }}>
            <Check size={14} /> Chave de API válida! Ligação ao TMDB estabelecida.
          </div>
        )}
        {testResult === 'fail' && (
          <div style={{ color: 'var(--red-accent)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '-8px', marginBottom: '16px' }}>
            <AlertCircle size={14} /> Chave de API inválida ou sem resposta do servidor.
          </div>
        )}

        <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', fontSize: '13px', display: 'flex', gap: '10px' }}>
          <HelpCircle size={20} style={{ color: 'var(--yellow-brand)', flexShrink: 0 }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '4px' }}>Como obter uma chave em 1 minuto:</strong>
            <ol style={{ paddingLeft: '16px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Cria uma conta gratuita em <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--yellow-brand)' }}>themoviedb.org</a></li>
              <li>Acede às definições da tua conta e clica na secção <strong>API</strong></li>
              <li>Cria uma chave do tipo "Developer" preenchendo os dados (podes colocar localhost no URL)</li>
              <li>Copia a tua <strong>API Key (v3)</strong> e cola-a no campo acima!</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Backup and Restore */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Download size={20} style={{ color: 'var(--yellow-brand)' }} />
          Cópia de Segurança e Restauro
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <button onClick={handleExportBackup} className="btn btn-secondary">
            <Download size={16} /> Exportar Backup (JSON)
          </button>
          
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={16} /> Importar Backup (JSON)
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportBackup} 
              style={{ display: 'none' }} 
            />
          </label>
        </div>
      </div>

      {/* TV Time Import Wizard button */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🐝 Migrar do TV Time
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '18px', lineHeight: '1.5' }}>
          Se exportaste o teu histórico do TV Time antes do encerramento oficial da aplicação, podes carregar o ficheiro CSV para recuperar todas as tuas séries, filmes vistos e datas no BeeTime!
        </p>
        <button onClick={onTriggerImportCSV} className="btn btn-primary">
          Abrir Importador do TV Time
        </button>
      </div>

      {/* Session Management */}
      {onLogout && (
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🚪 Sessão do Utilizador
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '18px' }}>
            Estás com a sessão iniciada com o e-mail: <strong>{localStorage.getItem('beetime_user_email')}</strong>
          </p>
          <button 
            onClick={() => {
              if (window.confirm('Tem a certeza de que deseja terminar a sessão?')) {
                onLogout();
              }
            }}
            className="btn btn-secondary"
            style={{ borderColor: 'var(--red-accent)', color: 'var(--red-accent)', background: 'none' }}
          >
            Terminar Sessão (Logout)
          </button>
        </div>
      )}

      {/* Danger Zone */}
      <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '20px', padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--red-accent)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trash2 size={20} />
          Zona de Perigo
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
          Limpar a base de dados elimina todos os metadados, séries seguidas e histórico local de visualizações. Esta operação é irreversível.
        </p>
        <button onClick={handleClearDatabase} className="btn btn-danger">
          Apagar Todos os Dados Locais
        </button>
      </div>
    </div>
  );
}
