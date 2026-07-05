import { useEffect, useState, useCallback } from 'react';

const TABS = [
  { key: 'pending_approval', label: 'Needs review' },
  { key: 'approved', label: 'Approved' },
  { key: 'queued', label: 'Sent' },
  { key: 'rejected', label: 'Rejected' },
];

export default function Dashboard() {
  const [tab, setTab] = useState('pending_approval');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);
  const [log, setLog] = useState('');
  const [editing, setEditing] = useState(null); // lead id currently being edited
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [emailDrafts, setEmailDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/leads?status=${tab}`);
    const data = await res.json();
    setLeads(data.leads || []);
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function runStep(step) {
    setRunning(step);
    setLog(`Running ${step}...`);
    try {
      const path = step === 'queue' ? '/api/queue' : `/api/cron/${step}`;
      const res = await fetch(path, { method: 'POST', headers: { 'x-dashboard-trigger': '1' } });
      const data = await res.json();
      setLog(JSON.stringify(data, null, 2));
      load();
    } catch (err) {
      setLog(`Error: ${err.message}`);
    }
    setRunning(null);
  }

  async function act(lead, action) {
    await fetch('/api/leads/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, action }),
    });
    load();
  }

  async function saveEdit(lead) {
    await fetch('/api/leads/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: lead.id,
        action: 'edit_approve',
        pitch_subject: editSubject,
        pitch_draft: editBody,
      }),
    });
    setEditing(null);
    load();
  }

  async function saveEmail(lead) {
    const email = emailDrafts[lead.id];
    if (!email) return;
    await fetch('/api/leads/set-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, email }),
    });
    load();
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.h1}>Leadgen Dashboard</h1>
        <div style={s.actions}>
          {['discover', 'score', 'pitch', 'queue'].map((step) => (
            <button
              key={step}
              onClick={() => runStep(step)}
              disabled={running !== null}
              style={s.runButton}
            >
              {running === step ? 'Running…' : `Run ${step}`}
            </button>
          ))}
        </div>
      </header>

      <nav style={s.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ ...s.tab, ...(tab === t.key ? s.tabActive : {}) }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {log && (
        <pre style={s.log}>{log}</pre>
      )}

      {loading ? (
        <p style={s.muted}>Loading…</p>
      ) : leads.length === 0 ? (
        <p style={s.muted}>Nothing here.</p>
      ) : (
        <div style={s.list}>
          {leads.map((lead) => (
            <div key={lead.id} style={s.card}>
              <div style={s.cardHeader}>
                <div>
                  <strong>{lead.business_name}</strong>{' '}
                  <span style={s.badge}>{lead.target_market}</span>{' '}
                  <span style={s.badge}>{lead.lead_temp}</span>
                </div>
                <span style={s.muted}>
                  {lead.website || 'no website found'}
                  {lead.digital_activity_score != null ? ` · score ${lead.digital_activity_score}/100` : ''}
                </span>
              </div>

              {lead.notes && <p style={s.issues}>Issues: {lead.notes}</p>}

              {editing === lead.id ? (
                <div style={s.editBox}>
                  <input
                    style={s.input}
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="Subject"
                  />
                  <textarea
                    style={s.textarea}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={6}
                  />
                  <div style={s.row}>
                    <button style={s.approveBtn} onClick={() => saveEdit(lead)}>Save & approve</button>
                    <button style={s.ghostBtn} onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={s.subject}>Subject: {lead.pitch_subject}</p>
                  <p style={s.body}>{lead.pitch_draft}</p>
                </>
              )}

              <div style={s.row}>
                <input
                  style={s.emailInput}
                  placeholder={lead.email || 'add email before it can be sent'}
                  defaultValue={lead.email || ''}
                  onChange={(e) => setEmailDrafts((d) => ({ ...d, [lead.id]: e.target.value }))}
                />
                <button style={s.ghostBtn} onClick={() => saveEmail(lead)}>Save email</button>
              </div>

              {tab === 'pending_approval' && editing !== lead.id && (
                <div style={s.row}>
                  <button style={s.approveBtn} onClick={() => act(lead, 'approve')}>Approve</button>
                  <button
                    style={s.ghostBtn}
                    onClick={() => {
                      setEditing(lead.id);
                      setEditSubject(lead.pitch_subject || '');
                      setEditBody(lead.pitch_draft || '');
                    }}
                  >
                    Edit
                  </button>
                  <button style={s.rejectBtn} onClick={() => act(lead, 'reject')}>Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  page: { maxWidth: 780, margin: '0 auto', padding: '32px 20px 80px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  h1: { fontSize: 20, margin: 0 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  runButton: {
    background: '#1b1e27', border: '1px solid #2c313d', color: '#e8eaed',
    borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer',
  },
  tabs: { display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #23262f', paddingBottom: 10 },
  tab: {
    background: 'transparent', border: 'none', color: '#9aa1ac',
    fontSize: 14, cursor: 'pointer', padding: '6px 10px', borderRadius: 6,
  },
  tabActive: { background: '#1b1e27', color: '#e8eaed' },
  log: {
    background: '#0b0d11', border: '1px solid #23262f', borderRadius: 8,
    padding: 12, fontSize: 12, maxHeight: 160, overflow: 'auto', color: '#9aa1ac',
  },
  muted: { color: '#7a818c', fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 14 },
  card: {
    background: '#171a21', border: '1px solid #23262f', borderRadius: 10,
    padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  badge: {
    fontSize: 11, background: '#23262f', padding: '2px 6px', borderRadius: 4,
    color: '#9aa1ac', textTransform: 'uppercase', letterSpacing: 0.3,
  },
  issues: { fontSize: 13, color: '#c9a35a', margin: 0 },
  subject: { fontSize: 13, color: '#9aa1ac', margin: 0, fontWeight: 600 },
  body: { fontSize: 14, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' },
  editBox: { display: 'flex', flexDirection: 'column', gap: 8 },
  input: {
    padding: '8px 10px', borderRadius: 6, border: '1px solid #2c313d',
    background: '#0f1115', color: '#e8eaed', fontSize: 13,
  },
  textarea: {
    padding: '8px 10px', borderRadius: 6, border: '1px solid #2c313d',
    background: '#0f1115', color: '#e8eaed', fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
  },
  row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  emailInput: {
    flex: 1, minWidth: 180, padding: '6px 10px', borderRadius: 6,
    border: '1px solid #2c313d', background: '#0f1115', color: '#e8eaed', fontSize: 13,
  },
  approveBtn: {
    background: '#2f7d4f', border: 'none', color: 'white', borderRadius: 6,
    padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
  },
  rejectBtn: {
    background: 'transparent', border: '1px solid #7a3535', color: '#ff8a8a',
    borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
  },
  ghostBtn: {
    background: 'transparent', border: '1px solid #2c313d', color: '#e8eaed',
    borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
  },
};
