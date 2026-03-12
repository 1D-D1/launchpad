'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface NotificationPrefs {
  emailDigest: boolean;
  pipelineAlerts: boolean;
  contentReady: boolean;
  weeklyReport: boolean;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
}

interface SmtpConfig {
  host: string;
  port: string;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

export default function SettingsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [activeSection, setActiveSection] = useState<'profile' | 'notifications' | 'api' | 'smtp'>('profile');

  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileCompany, setProfileCompany] = useState('');

  // Populate profile fields from session when it loads
  useEffect(() => {
    if (session?.user) {
      setProfileName(session.user.name ?? '');
      setProfileEmail(session.user.email ?? '');
    }
  }, [session]);

  const [notifications, setNotifications] = useState<NotificationPrefs>({
    emailDigest: true,
    pipelineAlerts: true,
    contentReady: true,
    weeklyReport: false,
  });

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    { id: '1', name: 'Production', key: 'lp_live_sk_...a3f8', createdAt: '2026-02-01' },
    { id: '2', name: 'Development', key: 'lp_test_sk_...b7c2', createdAt: '2026-03-01' },
  ]);

  const [smtp, setSmtp] = useState<SmtpConfig>({
    host: '',
    port: '587',
    username: '',
    password: '',
    fromName: '',
    fromEmail: '',
  });

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail,
          company: profileCompany,
        }),
      });
      if (res.ok) {
        setToast('Settings saved successfully.');
      } else {
        setToast('Failed to save settings. Please try again.');
      }
    } catch {
      setToast('An error occurred while saving.');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  function handleDeleteKey(id: string) {
    if (confirm('Are you sure you want to revoke this API key?')) {
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    }
  }

  function handleCreateKey() {
    const name = prompt('Enter a name for the new API key:');
    if (!name) return;
    setApiKeys((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name,
        key: `lp_test_sk_...${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString().slice(0, 10),
      },
    ]);
  }

  const sections = [
    { key: 'profile' as const, label: 'Profile' },
    { key: 'notifications' as const, label: 'Notifications' },
    { key: 'api' as const, label: 'API Keys' },
    { key: 'smtp' as const, label: 'SMTP Config' },
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-200 shadow-lg">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">Manage your account and integrations</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar nav */}
        <nav className="flex flex-row gap-1 lg:flex-col lg:w-48">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`rounded-lg px-4 py-2 text-left text-sm font-medium transition-colors ${
                activeSection === s.key
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          {/* Profile */}
          {activeSection === 'profile' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-white">Profile</h2>

              {sessionStatus === 'loading' ? (
                <div className="space-y-4">
                  <div className="h-10 animate-pulse rounded-lg bg-zinc-800" />
                  <div className="h-10 animate-pulse rounded-lg bg-zinc-800" />
                  <div className="h-10 animate-pulse rounded-lg bg-zinc-800" />
                </div>
              ) : (
                <>
                  {session?.user && (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 px-4 py-3 text-sm text-zinc-400">
                      Signed in as <span className="text-white font-medium">{session.user.email}</span>
                      {String((session.user as Record<string, unknown>).role ?? '') !== '' && (
                        <span className="ml-2 text-zinc-500">
                          Role: {String((session.user as Record<string, unknown>).role)}
                        </span>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300">Full Name</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300">Email</label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300">Company</label>
                    <input
                      type="text"
                      value={profileCompany}
                      onChange={(e) => setProfileCompany(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-white">Notification Preferences</h2>
              {[
                { key: 'emailDigest' as const, label: 'Daily Email Digest', desc: 'Receive a daily summary of all activity' },
                { key: 'pipelineAlerts' as const, label: 'Pipeline Alerts', desc: 'Get notified when pipeline stages complete or fail' },
                { key: 'contentReady' as const, label: 'Content Ready for Review', desc: 'Alert when AI-generated content needs your approval' },
                { key: 'weeklyReport' as const, label: 'Weekly Report', desc: 'Receive a weekly performance summary' },
              ].map((pref) => (
                <div key={pref.key} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{pref.label}</p>
                    <p className="text-xs text-zinc-500">{pref.desc}</p>
                  </div>
                  <button
                    onClick={() =>
                      setNotifications((prev) => ({ ...prev, [pref.key]: !prev[pref.key] }))
                    }
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      notifications[pref.key] ? 'bg-blue-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        notifications[pref.key] ? 'left-5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              ))}
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          )}

          {/* API Keys */}
          {activeSection === 'api' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">API Keys</h2>
                <button
                  onClick={handleCreateKey}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                >
                  Create Key
                </button>
              </div>
              <div className="space-y-3">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{key.name}</p>
                      <p className="font-mono text-xs text-zinc-500">{key.key}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500">{key.createdAt}</span>
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SMTP */}
          {activeSection === 'smtp' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-white">SMTP Configuration</h2>
              <p className="text-sm text-zinc-400">
                Configure your SMTP server for sending email sequences.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-300">SMTP Host</label>
                  <input
                    type="text"
                    value={smtp.host}
                    onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="smtp.example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300">Port</label>
                  <input
                    type="text"
                    value={smtp.port}
                    onChange={(e) => setSmtp((s) => ({ ...s, port: e.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="587"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300">Username</label>
                  <input
                    type="text"
                    value={smtp.username}
                    onChange={(e) => setSmtp((s) => ({ ...s, username: e.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300">Password</label>
                  <input
                    type="password"
                    value={smtp.password}
                    onChange={(e) => setSmtp((s) => ({ ...s, password: e.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Your SMTP password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300">From Name</label>
                  <input
                    type="text"
                    value={smtp.fromName}
                    onChange={(e) => setSmtp((s) => ({ ...s, fromName: e.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="LAUNCHPAD"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300">From Email</label>
                  <input
                    type="email"
                    value={smtp.fromEmail}
                    onChange={(e) => setSmtp((s) => ({ ...s, fromEmail: e.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="noreply@yourdomain.com"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save SMTP Config'}
                </button>
                <button
                  onClick={() => {
                    setToast('Test email feature coming soon.');
                    setTimeout(() => setToast(null), 3000);
                  }}
                  className="rounded-lg border border-zinc-700 px-6 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  Send Test Email
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
