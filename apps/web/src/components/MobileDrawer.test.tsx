import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileDrawer } from './MobileDrawer';

afterEach(() => {
  cleanup();
});

describe('MobileDrawer', () => {
  it('does not render when closed', () => {
    render(
      <MobileDrawer open={false} onClose={vi.fn()}>
        <div>Drawer content</div>
      </MobileDrawer>,
    );
    expect(screen.queryByText('Drawer content')).not.toBeInTheDocument();
  });

  it('renders content and title when open', () => {
    render(
      <MobileDrawer open={true} onClose={vi.fn()} title="Test Menu">
        <div>Drawer content</div>
      </MobileDrawer>,
    );
    expect(screen.getByText('Test Menu')).toBeInTheDocument();
    expect(screen.getByText('Drawer content')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <MobileDrawer open={true} onClose={handleClose}>
        <div>Drawer content</div>
      </MobileDrawer>,
    );
    const closeBtn = screen.getByLabelText('Close navigation menu');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <MobileDrawer open={true} onClose={handleClose}>
        <div>Drawer content</div>
      </MobileDrawer>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay backdrop is clicked', () => {
    const handleClose = vi.fn();
    render(
      <MobileDrawer open={true} onClose={handleClose}>
        <div>Drawer content</div>
      </MobileDrawer>,
    );
    const overlay = screen.getByRole('presentation');
    fireEvent.click(overlay);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
