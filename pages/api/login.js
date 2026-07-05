import { checkPassword, setAuthCookie } from '../../lib/auth';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { password } = req.body || {};
  if (!checkPassword(password)) return res.status(401).json({ error: 'invalid' });
  setAuthCookie(res);
  res.status(200).json({ ok: true });
}
