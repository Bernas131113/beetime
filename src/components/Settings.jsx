import React, { useState, useEffect } from 'react';
import { db, getSetting, setSetting } from '../db';
import { Download, Upload, Trash2, Check, AlertCircle } from 'lucide-react';

export default function Settings({ onTriggerImportCSV, onLogout }) {
  const [msg, setMsg] = useState(null);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingTop: '20px' }}>
      <div>
        <h1 className="page-title">Definições</h1>
        <p className="page-subtitle">Gere a tua conta, backups e dados locais.</p>
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
