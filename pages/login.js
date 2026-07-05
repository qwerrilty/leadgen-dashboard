import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push('/');
    } else {
      setError('Wrong password.');
    }
  }

  return (
    <div style={styles.wrap}>
      <form onSubmit={submit} style={styles.card}>
        <h1 style={styles.title}>Leadgen Dashboard</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={styles.input}
          autoFocus
        />
        {error && <p style={styles.error}>{error}</p>}
        <button type="submit" style={styles.button}>Enter</button>
      </form>
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#0f1115', fontFamily: 'system-ui, sans-serif',
  },
  card: {
    background: '#171a21', padding: '32px', borderRadius: '12px',
    width: '280px', display: 'flex', flexDirection: 'column', gap: '12px',
    border: '1px solid #262a35',
  },
  title: { color: '#e8eaed', fontSize: '18px', margin: 0, marginBottom: '8px' },
  input: {
    padding: '10px 12px', borderRadius: '8px', border: '1px solid #2c313d',
    background: '#0f1115', color: '#e8eaed', fontSize: '14px',
  },
  button: {
    padding: '10px 12px', borderRadius: '8px', border: 'none',
    background: '#4f7cff', color: 'white', fontWeight: 600, cursor: 'pointer',
  },
  error: { color: '#ff6b6b', fontSize: '13px', margin: 0 },
};
