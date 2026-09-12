import React from 'react';
import { Card } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { ArtworkMedia, ARTWORK_MEDIA_SIZES } from './ArtworkMedia';

export interface ArtworkCardProps {
  id?: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  categoryName?: string;
  categorySlug?: string;
  price: number;
  statusBadge?: React.ReactNode;
  categoryBadge?: React.ReactNode;
  href?: string;
  actionLabel?: string;
  priority?: boolean;
  className?: string;
  asImage?: React.ElementType;
  asLink?: React.ElementType;
  onActionClick?: () => void;
}

export const ArtworkCard: React.FC<ArtworkCardProps> = ({
  title,
  description,
  imageUrl,
  categoryName,
  price,
  statusBadge,
  categoryBadge,
  href,
  actionLabel = 'View Editions →',
  priority = false,
  className = '',
  asImage,
  asLink: LinkComponent,
  onActionClick,
}) => {
  const content = (
    <Card
      className={`group flex flex-col justify-between overflow-hidden p-0 border-slate-800 hover:border-amber-500/40 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/5 ${className}`}
    >
      {/* Visual Header / Media Container */}
      <div className="relative aspect-square w-full bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-950 overflow-hidden flex items-center justify-center border-b border-slate-800/80">
        <ArtworkMedia
          src={imageUrl || ''}
          alt={title}
          sizes={ARTWORK_MEDIA_SIZES.CATALOG_GRID}
          aspectRatio="square"
          priority={priority}
          asImage={asImage}
          imgClassName="group-hover:scale-105 transition-transform duration-500"
        />

        {/* Top Badges Overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
          {categoryBadge ||
            (categoryName && (
              <Badge variant="neutral" className="bg-slate-950/80 backdrop-blur-md text-xs">
                {categoryName}
              </Badge>
            ))}
          {statusBadge || (
            <Badge variant="warning" className="bg-amber-950/80 backdrop-blur-md text-xs">
              Active Drop
            </Badge>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-100 group-hover:text-amber-400 transition-colors line-clamp-1">
            {title}
          </h2>
          {description && (
            <p className="text-slate-400 text-sm line-clamp-2 leading-relaxed">{description}</p>
          )}
        </div>

        {/* Price & Action */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-mono">Starting at</span>
            <span className="text-2xl font-black text-amber-400">${Number(price).toFixed(2)}</span>
          </div>

          {LinkComponent && href ? (
            <LinkComponent href={href}>
              <Button variant="primary" size="sm" className="font-semibold" onClick={onActionClick}>
                {actionLabel}
              </Button>
            </LinkComponent>
          ) : href ? (
            <a href={href}>
              <Button variant="primary" size="sm" className="font-semibold" onClick={onActionClick}>
                {actionLabel}
              </Button>
            </a>
          ) : (
            <Button variant="primary" size="sm" className="font-semibold" onClick={onActionClick}>
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );

  return content;
};
