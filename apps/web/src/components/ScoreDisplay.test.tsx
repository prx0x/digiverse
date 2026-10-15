import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScoreDisplay } from './ScoreDisplay';

describe('ScoreDisplay', () => {
  it('renders exactly 4 decimal places', () => {
    render(<ScoreDisplay value="12.3456789012" />);
    expect(screen.getByLabelText('12.3457')).toHaveTextContent('12.3457');
  });

  it('pads short values', () => {
    render(<ScoreDisplay value={3} label="Total" />);
    expect(screen.getByLabelText('Total: 3.0000')).toHaveTextContent('3.0000');
  });
});
