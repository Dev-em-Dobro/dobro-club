// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../auth/AuthContext.jsx', () => ({
  useAuth: () => ({ loading: false, lead: { name: 'Diego', eventId: 'evt_test' } })
}));

import EventHome from './EventHome.jsx';

describe('EventHome', () => {
  it('greets the lead and renders the participant bottom-nav placeholders', () => {
    render(<EventHome />);
    expect(screen.getByText(/Diego/)).toBeTruthy();
    for (const item of ['Aulas', 'Comunidade', 'Feed', 'Ingresso', 'Indicações', 'Certificado']) {
      expect(screen.getByRole('button', { name: item, hidden: true })).toBeTruthy();
    }
  });
});
