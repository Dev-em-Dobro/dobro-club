// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext.jsx';

function Probe() {
  const { loading, lead } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{lead ? `oi ${lead.name}` : 'sem sessão'}</div>;
}

afterEach(() => { vi.restoreAllMocks(); });

describe('AuthContext', () => {
  it('loads the lead from /api/me', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ leadId: 'lead_1', name: 'Diego', eventId: 'evt_test' })
    });
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('oi Diego')).toBeTruthy();
  });

  it('shows no session on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('sem sessão')).toBeTruthy();
  });

  it('shows no session when the request fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('net'));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('sem sessão')).toBeTruthy();
  });
});
