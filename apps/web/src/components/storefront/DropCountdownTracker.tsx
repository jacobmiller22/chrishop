'use client';

import React, { useEffect } from 'react';
import { trackCountdownView } from '../../lib/funnel-client';

export interface DropCountdownTrackerProps {
  dropId?: string;
  productId?: string;
  title?: string;
  targetDate?: string;
}

/**
 * DropCountdownTracker
 *
 * Client-side beacon component that emits a `countdown_view` telemetry event
 * when a drop countdown timer is rendered in the shopper's viewport.
 */
export const DropCountdownTracker: React.FC<DropCountdownTrackerProps> = ({
  dropId = 'bankbeaters-leadville',
  productId = 'workshop-drop-countdown',
  title = 'Workshop Drop Countdown',
  targetDate,
}) => {
  useEffect(() => {
    trackCountdownView(dropId, productId, { title, targetDate });
  }, [dropId, productId, title, targetDate]);

  return null;
};
