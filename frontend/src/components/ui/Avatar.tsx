import React from 'react';
import './Avatar.css';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  letter?: string;
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'soft' | 'gold' | 'surface';
  className?: string;
}

export function Avatar({
  name,
  letter,
  src,
  alt = '',
  size = 'md',
  variant = 'primary',
  className = '',
  ...props
}: AvatarProps): React.ReactElement {
  const displayLetter = letter ?? (name ? Array.from(name)[0] : '');

  return (
    <div
      className={`ui-avatar ui-avatar--${size} ui-avatar--${variant} ${className}`.trim()}
      aria-label={name || alt}
      role={src ? 'img' : undefined}
      {...props}
    >
      {src ? (
        <img src={src} alt={alt || name || 'Avatar'} className="ui-avatar__img" />
      ) : (
        <span className="ui-avatar__letter" aria-hidden="true">
          {displayLetter}
        </span>
      )}
    </div>
  );
}
