import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Unsubscribe() {
  const router = useRouter();
  const { lead } = router.query;
  const [state, setState] = useState('idle'); // idle | working | done | error

  async function confirm() {
    setState('working');
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        {state === 'done' ? (
          <>
            <h1 style={s.title}>You're unsubscribed</h1>
            <p style={s.text}>We won't send you any further emails about this.</p>
          </>
        ) : state === 'error' ? (
          <>
            <h1 style={s.title}>Something went wrong</h1>
            <p style={s.text}>We couldn't process this automatically. Reply to the email directly and we'll remove you by hand.</p>
          </>
        ) : (
          <>
            <h1 style={s.title}>Unsubscribe</h1>
            <p style={s.text}>Confirm you'd like to stop receiving emails about this offer.</p>
            <button style={s.button} onClick={confirm} disabled={!lead || state === 'working'}>
              {state === 'working' ? 'Working…' : 'Confirm unsubscribe'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#0f1115', fontFamily: 'system-ui, sans-serif',
  },
  card: {
    background: '#171a21', padding: '32px', borderRadius: '12px',
    width: '320px', border: '1px solid #262a35', textAlign: 'center',
  },
  title: { color: '#e8eaed', fontSize: '18px', margin: '0 0 8px' },
  text: { color: '#9aa1ac', fontSize: '14px', margin: '0 0 16px', lineHeight: 1.5 },
  button: {
    padding: '10px 16px', borderRadius: '8px', border: 'none',
    background: '#4f7cff', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14,
  },
};
