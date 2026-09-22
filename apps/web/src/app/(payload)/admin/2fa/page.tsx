'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminTwoFactorChallengePage() {
  const router = useRouter();
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = isRecoveryMode
        ? { action: 'recovery', recoveryCode: recoveryCode.trim() }
        : { action: 'verify', code: totpCode.trim() };

      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication challenge failed');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin');
      }, 750);
    } catch (err: any) {
      setError(err.message || 'An error occurred during verification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1215] text-[#ECEFF1] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[#15191E] border border-stone-800 rounded-xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[#E55B24]/10 border border-[#E55B24]/30 flex items-center justify-center mb-4 text-[#E55B24]">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            Two-Factor Authentication
          </h1>
          <p className="text-xs uppercase tracking-widest text-[#E55B24] font-mono">
            Mandatory Admin Perimeter Gate
          </p>
          <p className="text-sm text-stone-400 mt-2">
            {isRecoveryMode
              ? 'Enter an emergency one-time backup recovery code (e.g. XXXX-XXXX).'
              : 'Enter the 6-digit verification code from your authenticator app.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Verified! Redirecting to admin panel...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isRecoveryMode ? (
            <div>
              <label
                htmlFor="totpCode"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-2"
              >
                Security Code (6 Digits)
              </label>
              <input
                id="totpCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                required
                className="w-full text-center tracking-[0.5em] font-mono text-2xl px-4 py-3 bg-[#0B0E11] border border-stone-800 rounded-lg text-white focus:outline-none focus:border-[#E55B24] transition-colors"
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor="recoveryCode"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-2"
              >
                Emergency Recovery Code
              </label>
              <input
                id="recoveryCode"
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                autoFocus
                required
                className="w-full text-center tracking-widest font-mono text-lg px-4 py-3 bg-[#0B0E11] border border-stone-800 rounded-lg text-white focus:outline-none focus:border-[#E55B24] transition-colors"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-3 px-4 rounded-lg bg-[#E55B24] hover:bg-[#D44E19] text-white font-medium text-sm transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isRecoveryMode ? (
              'Verify Recovery Code'
            ) : (
              'Verify & Access /admin'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-stone-800/80 flex justify-between text-xs text-stone-400">
          <button
            type="button"
            onClick={() => {
              setIsRecoveryMode(!isRecoveryMode);
              setError(null);
            }}
            className="hover:text-white transition-colors underline underline-offset-4"
          >
            {isRecoveryMode ? 'Use Authenticator App' : 'Use Emergency Backup Code'}
          </button>
          <a
            href="/admin/login"
            className="hover:text-white transition-colors"
          >
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}
