import { useState } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  to?: string;
  inverse?: boolean;
  className?: string;
  variant?: 'left-aligned' | 'centered' | 'bracket';
};

const LOGO_PATHS = {
  'left-aligned': '/assets/GDSCUTM-LeftAligned-IIIT-Kota.svg',
  centered: '/assets/GDSCUTM-Centered-IIIT-Kota.svg',
  bracket: '/assets/GDSCUTM-Bracket.svg',
} as const;

/**
 * Brand wordmark integrating official GDGoC IIIT Kota logos per OPEN-025.
 * Falls back to accessible text wordmark if the asset fails to load.
 */
export function Wordmark({
  to = '/',
  inverse = false,
  className = '',
  variant = 'left-aligned',
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);

  const classes = [
    'wordmark',
    inverse ? 'wordmark--inverse' : '',
    `wordmark--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const logoSrc = LOGO_PATHS[variant];

  const content = (
    <>
      <div className="wordmark__brand-row">
        <span className="wordmark__brand">DIGIVERSE</span>
      </div>
      {!imgFailed ? (
        <img
          src={logoSrc}
          alt="GDGoC IIIT Kota"
          className="wordmark__logo"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="wordmark__org">GDGoC IIIT Kota</span>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} aria-label="Digiverse home">
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
