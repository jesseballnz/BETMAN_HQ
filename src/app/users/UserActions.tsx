'use client';

import { useState } from 'react';

export default function UserActions({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);
  const [setupLink, setSetupLink] = useState('');
  const [error, setError] = useState('');

  async function generatePasswordResetLink() {
    if (!window.confirm(`Generate a new password reset link for ${email}? Any previous setup link will stop working.`)) {
      return;
    }

    setLoading(true);
    setSetupLink('');
    setError('');

    try {
      const response = await fetch('/api/users/password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await response.json();
      if (!response.ok || body?.ok !== true) {
        throw new Error(body?.error || 'Reset link generation failed');
      }
      setSetupLink(String(body.setupLink || ''));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Reset link generation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg text-right">
      <button
        type="button"
        onClick={generatePasswordResetLink}
        disabled={loading}
        className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-gray-950 disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate password reset link'}
      </button>
      {setupLink && (
        <div className="mt-2 text-xs">
          <a className="break-all text-emerald-300 underline" href={setupLink} target="_blank" rel="noreferrer">
            Open reset link
          </a>
          <p className="mt-1 text-slate-500">Valid for 24 hours. Send only to the account owner.</p>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
