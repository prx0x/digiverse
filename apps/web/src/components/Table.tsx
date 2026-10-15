import type { ReactNode } from 'react';

type Props = {
  headers: string[];
  children: ReactNode;
  caption?: string;
  className?: string;
};

export function Table({ headers, children, caption, className = '' }: Props) {
  return (
    <div className={`table-wrap ${className}`.trim()}>
      <table className="table">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
