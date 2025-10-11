import React, { useState } from 'react';
import './Login.css';

interface LoginProps {
  onLogin: (username: string, role: 'admin' | 'physician') => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // For demo: hardcoded users
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin123') {
      onLogin(username, 'admin');
    } else if (username === 'physician' && password === 'physician123') {
      onLogin(username, 'physician');
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Login</h2>
        {error && <div className="login-error">{error}</div>}
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button type="submit">Login</button>
        <div className="login-hint">
          <div>Admin: <b>admin/admin123</b></div>
          <div>Physician: <b>physician/physician123</b></div>
        </div>
      </form>
    </div>
  );
};

export default Login;
