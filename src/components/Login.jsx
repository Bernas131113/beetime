import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, insira um e-mail válido.');
      return;
    }

    // Passwords should be at least 4 characters
    if (password.length < 4) {
      setError('A palavra-passe deve conter pelo menos 4 caracteres.');
      return;
    }

    setLoading(true);

    // Simulate login loading for premium feel
    setTimeout(() => {
      setLoading(false);
      localStorage.setItem('beetime_user_email', email.trim().toLowerCase());
      onLoginSuccess();
    }, 800);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0a0c14',
      backgroundImage: 'radial-gradient(circle at top right, rgba(255, 215, 0, 0.1) 0%, transparent 40%), radial-gradient(circle at bottom left, rgba(0, 102, 204, 0.08) 0%, transparent 45%)',
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      
      {/* Login Card */}
      <div style={{
        width: '100%',
        maxWidth: '380px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
      }}>
        
        {/* Bee Logo Icon */}
        <img 
          src="/apple-touch-icon.png" 
          alt="BeeTime Logo" 
          style={{
            width: '74px',
            height: '74px',
            borderRadius: '22px',
            marginBottom: '20px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            border: '1.5px solid rgba(255, 255, 255, 0.08)'
          }}
        />

        {/* Branding Title */}
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#fff', letterSpacing: '-0.8px', marginBottom: '6px' }}>BeeTime</h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: '28px', lineHeight: '1.4', fontWeight: '500' }}>
          O teu rastreador pessoal de séries e filmes
        </p>

        {/* Error Message */}
        {error && (
          <div style={{
            width: '100%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '12px',
            padding: '12px',
            color: '#ef4444',
            fontSize: '12.5px',
            fontWeight: '600',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Email Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>E-mail</label>
            <input 
              type="email"
              placeholder="exemplo@mail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1.5px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '14px',
                color: '#fff',
                outline: 'none',
                fontWeight: '600',
                transition: 'border 0.2s'
              }}
              onFocus={e => e.target.style.borderColor = '#ffcc00'}
              onBlur={e => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
            />
          </div>

          {/* Password Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Palavra-passe</label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input 
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1.5px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '12px 42px 12px 14px',
                  fontSize: '14px',
                  color: '#fff',
                  outline: 'none',
                  fontWeight: '600',
                  transition: 'border 0.2s'
                }}
                onFocus={e => e.target.parentNode.firstChild.style.borderColor = '#ffcc00'}
                onBlur={e => e.target.parentNode.firstChild.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: '#ffcc00',
              color: '#000',
              border: 'none',
              borderRadius: '14px',
              padding: '14px',
              fontSize: '14px',
              fontWeight: '900',
              cursor: loading ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(255, 204, 0, 0.15)',
              marginTop: '12px',
              transition: 'transform 0.1s, opacity 0.2s',
              opacity: loading ? 0.8 : 1
            }}
            onMouseDown={e => { if (!loading) e.target.style.transform = 'scale(0.98)'; }}
            onMouseUp={e => { if (!loading) e.target.style.transform = 'scale(1)'; }}
          >
            {loading ? (
              <div className="tvtime-loader" style={{ width: '18px', height: '18px', borderColor: '#000', borderTopColor: 'transparent' }} />
            ) : (
              'ENTRAR'
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
