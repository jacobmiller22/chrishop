'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface CountdownTimerProps {
  targetDate: Date | string | number;
  onComplete?: () => void;
  className?: string;
  compact?: boolean;
  completedLabel?: string;
  showLabels?: boolean;
}

export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isComplete: boolean;
}

export function calculateTimeRemaining(target: Date | string | number): TimeRemaining {
  const targetMs =
    typeof target === 'number'
      ? target
      : target instanceof Date
        ? target.getTime()
        : new Date(target).getTime();

  if (isNaN(targetMs)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isComplete: true };
  }

  const now = Date.now();
  const totalMs = targetMs - now;

  if (totalMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isComplete: true };
  }

  const totalSeconds = Math.floor(totalMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  return { days, hours, minutes, seconds, totalMs, isComplete: false };
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  targetDate,
  onComplete,
  className = '',
  compact = false,
  completedLabel = 'Available Now',
  showLabels = true,
}) => {
  const [time, setTime] = useState<TimeRemaining>(() => calculateTimeRemaining(targetDate));
  const hasCalledOnComplete = useRef(false);

  const checkAndTick = useCallback(() => {
    const nextTime = calculateTimeRemaining(targetDate);
    setTime(nextTime);

    if (nextTime.isComplete && !hasCalledOnComplete.current) {
      hasCalledOnComplete.current = true;
      onComplete?.();
    }
  }, [targetDate, onComplete]);

  useEffect(() => {
    hasCalledOnComplete.current = false;
    checkAndTick();

    const interval = setInterval(checkAndTick, 1000);
    return () => clearInterval(interval);
  }, [checkAndTick]);

  if (time.isComplete) {
    if (compact) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded backdrop-blur-md ${className}`}
          role="status"
          aria-live="polite"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{completedLabel}</span>
        </span>
      );
    }

    return (
      <div
        className={`flex items-center gap-2 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 font-mono text-sm font-bold shadow-lg ${className}`}
        role="status"
        aria-live="polite"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>{completedLabel}</span>
      </div>
    );
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-mono text-xs font-bold text-orange-400 bg-[#15191E]/90 border border-stone-700/80 px-2 py-0.5 rounded backdrop-blur-md ${className}`}
        role="timer"
        aria-live="off"
      >
        <span className="text-[#E55B24]">⏳</span>
        <span>
          {time.days > 0 && `${time.days}d `}
          {pad(time.hours)}h {pad(time.minutes)}m {pad(time.seconds)}s
        </span>
      </span>
    );
  }

  return (
    <div
      className={`p-4 rounded-xl bg-[#15191E] border border-stone-800 space-y-3 font-mono ${className}`}
      role="timer"
      aria-label="Drop countdown timer"
    >
      <div className="flex items-center justify-between text-xs text-stone-400 uppercase tracking-wider border-b border-stone-800/80 pb-2">
        <span className="flex items-center gap-1.5 text-[#E55B24] font-bold">
          <span>⚡</span>
          <span>Scheduled Drop Release</span>
        </span>
        <span className="text-[10px] text-stone-500">Live Release Lock</span>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center">
        <div className="bg-[#101317] border border-stone-800 rounded-lg p-2 sm:p-2.5">
          <div className="text-xl sm:text-2xl font-black text-stone-100">{pad(time.days)}</div>
          {showLabels && <div className="text-[10px] text-stone-500 uppercase tracking-wider mt-0.5">Days</div>}
        </div>
        <div className="bg-[#101317] border border-stone-800 rounded-lg p-2 sm:p-2.5">
          <div className="text-xl sm:text-2xl font-black text-stone-100">{pad(time.hours)}</div>
          {showLabels && <div className="text-[10px] text-stone-500 uppercase tracking-wider mt-0.5">Hours</div>}
        </div>
        <div className="bg-[#101317] border border-stone-800 rounded-lg p-2 sm:p-2.5">
          <div className="text-xl sm:text-2xl font-black text-[#E55B24]">{pad(time.minutes)}</div>
          {showLabels && <div className="text-[10px] text-stone-500 uppercase tracking-wider mt-0.5">Mins</div>}
        </div>
        <div className="bg-[#101317] border border-stone-800 rounded-lg p-2 sm:p-2.5">
          <div className="text-xl sm:text-2xl font-black text-[#E55B24]">{pad(time.seconds)}</div>
          {showLabels && <div className="text-[10px] text-stone-500 uppercase tracking-wider mt-0.5">Secs</div>}
        </div>
      </div>
    </div>
  );
};
