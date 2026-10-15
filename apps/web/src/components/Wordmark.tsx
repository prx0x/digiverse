import { Link } from 'react-router-dom';

type Props = {
  to?: string;
  inverse?: boolean;
  className?: string;
};

/**
 * Replaceable text identity until an official GDGoC logo asset is supplied.
 * Do not fabricate a logo graphic here.
 */
export function Wordmark({ to = '/', inverse = false, className = '' }: Props) {
  const classes = ['wordmark', inverse ? 'wordmark--inverse' : '', className]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className="wordmark__brand">DIGIVERSE</span>
      <span className="wordmark__org">GDGoC IIIT Kota</span>
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
