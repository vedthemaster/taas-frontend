'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Script from 'next/script';
import {
  SpinnerGap,
  CloudArrowUp,
  Lightning,
  ShieldCheck
} from '@phosphor-icons/react';
import { useAuthStore } from '@/lib/store';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function AuthPage() {
  const router = useRouter();
  const { googleSignIn, isAuthenticated, isLoading: authLoading, checkAuth, user } = useAuthStore();

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (user.hasTelegramConfig) {
        router.push('/dashboard');
      } else {
        router.push('/setup');
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (isGoogleLoaded && window.google) {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

      if (!clientId) {
        setError('Google Client ID not configured');
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCallback,
      });

      const buttonElement = document.getElementById('google-signin-button');
      if (buttonElement) {
        window.google.accounts.id.renderButton(buttonElement, {
          theme: 'filled_black',
          size: 'large',
          width: 320,
          text: 'continue_with',
          shape: 'pill',
        });
      }
    }
  }, [isGoogleLoaded]);

  const handleGoogleCallback = async (response: { credential: string }) => {
    setError('');
    setIsLoading(true);

    try {
      await googleSignIn(response.credential);
      // Navigation handled by useEffect above
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to sign in with Google');
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        onLoad={() => setIsGoogleLoaded(true)}
        strategy="afterInteractive"
      />

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

        {/* Right side - Auth */}
        <div className="flex-1 flex items-center justify-center px-6 py-8 lg:py-12">
          <div className="w-full max-w-sm animate-fade-in-up">

            <div className="glass-card p-8">
              <h2 className="text-2xl font-semibold text-center mb-2">Welcome</h2>
              <p className="text-gray-400 text-sm text-center mb-8">
                Sign in to access your cloud storage
              </p>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
                  {error}
                </div>
              )}

              {isLoading ? (
                <div className="flex justify-center py-4">
                  <SpinnerGap weight="bold" className="w-8 h-8 animate-spin text-blue-400" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div id="google-signin-button" className="w-full flex justify-center" />

                  {!isGoogleLoaded && (
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <SpinnerGap className="w-4 h-4 animate-spin" />
                      Loading...
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-500 text-center mt-6">
                By signing in, you agree to our Terms of Service
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
