import React, { useState } from 'react';
import './Login.css';
import { api } from '../utils/api';

interface LoginProps {
  onLogin: (user: { username: string; role: 'admin' | 'physician' | 'hospital'; providerId?: string | null; siteId?: string | null }) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await api.login(username, password);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

return (
  <div className="login-page">
    <form className="login-card" onSubmit={handleSubmit}>
      <h2 className="title">Login</h2>
      {error && <div className="alert alert-error login-error">{error}</div>}
      <input
        className="input"
        type="text"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        autoFocus
      />
      <input
        className="input"
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button className="btn btn-primary" type="submit">Login</button>
      <div className="muted-hint">
        <div>Admin: <b>admin/admin123</b></div>
        <div>Physician: <b>physician/physician123</b></div>
      </div>
    </form>
  </div>
);
};

export default Login;
