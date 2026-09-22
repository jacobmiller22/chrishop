'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from './Badge';

export interface DropCountdownProps {
  targetDate?: Date | string;
  title?: string;
  className?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

export const DropCountdown: React.FC<DropCountdownProps> = ({
  targetDate,
  title = 'Next Workshop Drop',
  className = '',
}) => {
  // Default drop target: 48 hours from now for deterministic local demonstration
  const [target] = useState<number>(() => {
    if (targetDate) return new Date(targetDate).getTime();
    // Default to a 24-hour countdown if not explicitly passed
    return Date.now() + 24 * 60 * 60 * 1000 + 14 * 60 * 1000 + 32 * 1000;
  });

  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 1,
    hours: 0,
    minutes: 14,
    seconds: 32,
    isExpired: false,
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const calculateTime = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeRemaining({ days, hours, minutes, seconds, isExpired: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [target]);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div
      data-testid="drop-countdown-timer"
      className={`inline-flex flex-col sm:flex-row items-center gap-3 p-3 sm:px-4 sm:py-2.5 rounded-xl bg-[#101317]/90 border border-stone-800 shadow-xl backdrop-blur-md ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#E55B24] animate-pulse" />
        <span className="text-xs font-mono uppercase tracking-widest text-stone-300 font-bold">
          {title}
        </span>
        <Badge variant="warning" className="text-[10px] font-mono uppercase tracking-wider py-0 px-1.5">
          Small-Batch
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 font-mono text-xs sm:text-sm font-black text-stone-100">
        <div className="flex flex-col items-center bg-[#15191E] border border-stone-800 rounded px-2 py-0.5">
          <span data-testid="countdown-hours">
            {mounted ? pad(timeRemaining.days * 24 + timeRemaining.hours) : '24'}
          </span>
          <span className="text-[9px] font-normal text-stone-500 uppercase tracking-tighter">HRS</span>
        </div>
        <span className="text-[#E55B24] font-bold">:</span>
        <div className="flex flex-col items-center bg-[#15191E] border border-stone-800 rounded px-2 py-0.5">
          <span data-testid="countdown-minutes">
            {mounted ? pad(timeRemaining.minutes) : '14'}
          </span>
          <span className="text-[9px] font-normal text-stone-500 uppercase tracking-tighter">MIN</span>
        </div>
        <span className="text-[#E55B24] font-bold">:</span>
        <div className="flex flex-col items-center bg-[#15191E] border border-stone-800 rounded px-2 py-0.5">
          <span data-testid="countdown-seconds">
            {mounted ? pad(timeRemaining.seconds) : '32'}
          </span>
          <span className="text-[9px] font-normal text-stone-500 uppercase tracking-tighter">SEC</span>
        </div>
      </div>
    </div>
  );
};
