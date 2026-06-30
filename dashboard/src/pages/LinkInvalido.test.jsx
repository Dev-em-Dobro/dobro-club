// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LinkInvalido from './LinkInvalido.jsx';

describe('LinkInvalido', () => {
  it('shows the message and a request-new-link action', () => {
    render(<LinkInvalido />);
    expect(screen.getByText(/não está mais válido/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /pedir novo link/i })).toBeTruthy();
  });
});
