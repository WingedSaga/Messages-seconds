import { useState } from 'react';
import { initialOf } from '../utils/format';

const SIZES = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-2xl',
};

// Аватар: картинка, а при её отсутствии или ошибке загрузки — буква имени.
// Пустой серый круг ничего не говорит, буква хотя бы различает собеседников.
export default function Avatar({ name, src, size = 'md', online = false, group = false }) {
  const [broken, setBroken] = useState(false);
  const showImage = src && !broken;

  return (
    <span className={`relative shrink-0 ${SIZES[size]}`}>
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className={`h-full w-full object-cover ${group ? 'rounded-2xl' : 'rounded-full'}`}
        />
      ) : (
        <span
          className={`grid h-full w-full place-items-center bg-brand-accent font-semibold
            text-brand-dark ${group ? 'rounded-2xl' : 'rounded-full'}`}
        >
          {initialOf(name)}
        </span>
      )}

      {online && (
        <span
          title="в сети"
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-brand"
        />
      )}
    </span>
  );
}
