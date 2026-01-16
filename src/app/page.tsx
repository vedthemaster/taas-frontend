'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowRight,
  SpinnerGap,
  CloudArrowUp,
  Lightning,
  ShieldCheck
} from '@phosphor-icons/react';
import { useAuthStore } from '@/lib/store';

export default function AuthPage() {
  const router = useRouter();
  const { login, register } = useAuthStore();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        router.push('/dashboard');
      } else {
        await register(email, password);
        router.push('/setup');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || (isLogin ? 'Failed to login' : 'Failed to create account'));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col lg:flex-row">
      {/* Background orbs */}
      <div className="orb orb-blue w-96 h-96 top-20 -left-48 animate-pulse-glow" />
      <div className="orb orb-cyan w-80 h-80 bottom-20 right-20 animate-pulse-glow delay-200" />

      {/* Left side - Hero content */}
      <div className="flex lg:w-1/2 flex-col justify-center px-6 pt-12 pb-8 lg:px-12 xl:px-20 lg:py-0 relative">
        <div className="animate-fade-in-up">
          <div className="mb-6 lg:mb-8">
            <Image src="/tass.png" alt="TAAS" width={160} height={56} className="h-12 lg:h-14 w-auto" />
          </div>

          <h1 className="text-4xl lg:text-5xl xl:text-6xl font-medium leading-tight mb-4 lg:mb-6 tracking-tight">
            Your files,
            <br />
            <span className="gradient-text">unlimited storage</span>
          </h1>

          <p className="text-sm lg:text-base text-gray-400 mb-8 lg:mb-12 max-w-md leading-relaxed">
            Store your files securely using Telegram as your personal cloud.
            No storage limits, no monthly fees.
          </p>

          <div className="space-y-4 lg:space-y-6">
            <div className="flex items-center gap-3 lg:gap-4 animate-slide-in-left delay-100">
              <Lightning weight="duotone" className="w-5 h-5 text-blue-400" />
              <span className="text-sm lg:text-base text-gray-300">Upload files up to 2GB</span>
            </div>

            <div className="flex items-center gap-3 lg:gap-4 animate-slide-in-left delay-200">
              <ShieldCheck weight="duotone" className="w-5 h-5 text-cyan-400" />
              <span className="text-sm lg:text-base text-gray-300">Your files stay in your channel</span>
            </div>

            <div className="flex items-center gap-3 lg:gap-4 animate-slide-in-left delay-300">
              <CloudArrowUp weight="duotone" className="w-5 h-5 text-purple-400" />
              <span className="text-sm lg:text-base text-gray-300">No caps, no quotas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="flex-1 flex items-center justify-center px-6 py-8 lg:py-12">
        <div className="w-full max-w-sm animate-fade-in-up">

          <div className="glass-card p-8">
            {/* Tabs */}
            <div className="flex gap-1 mb-8 p-1 bg-white/5 rounded-lg">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${isLogin
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${!isLogin
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="email" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="password" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {!isLogin && (
                <div className="space-y-1 animate-fade-in-up">
                  <label htmlFor="confirmPassword" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full mt-4"
              >
                {isLoading ? (
                  <SpinnerGap weight="bold" className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Continue' : 'Create account'}
                    <ArrowRight weight="bold" className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
