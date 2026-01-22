'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
    ArrowRight,
    SpinnerGap,
    CheckCircle,
    ArrowSquareOut,
    SkipForward
} from '@phosphor-icons/react';
import { telegramApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function SetupPage() {
    const router = useRouter();
    const { checkAuth, isAuthenticated, isLoading: authLoading, user } = useAuthStore();

    const [botToken, setBotToken] = useState('');
    const [channelId, setChannelId] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSkipping, setIsSkipping] = useState(false);
    const [step, setStep] = useState<'form' | 'validating' | 'success'>('form');

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/');
        } else if (isAuthenticated && user?.hasTelegramConfig) {
            router.push('/dashboard');
        }
    }, [authLoading, isAuthenticated, user, router]);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
                <div className="spinner" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        setStep('validating');

        try {
            await telegramApi.setup(botToken, channelId);
            setStep('success');
            setTimeout(() => {
                router.push('/dashboard');
            }, 2000);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to setup Telegram');
            setStep('form');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkip = async () => {
        setError('');
        setIsSkipping(true);

        try {
            await telegramApi.skipSetup();
            setStep('success');
            setTimeout(() => {
                router.push('/dashboard');
            }, 2000);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to skip setup');
        } finally {
            setIsSkipping(false);
        }
    };

    if (step === 'success') {
        return (
            <div className="min-h-screen bg-gradient-hero flex items-center justify-center px-6 py-12">
                <div className="text-center animate-fade-in-up">
                    <CheckCircle weight="duotone" className="w-16 h-16 text-green-400 mx-auto mb-6" />
                    <h2 className="text-2xl font-medium mb-2">Connected</h2>
                    <p className="text-gray-500">Redirecting to dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-hero flex items-center justify-center px-6 py-6 relative overflow-hidden">
            {/* Background orbs */}
            <div className="orb orb-blue w-96 h-96 -top-48 left-1/4 animate-pulse-glow" />
            <div className="orb orb-cyan w-80 h-80 bottom-20 right-1/4 animate-pulse-glow delay-200" />

            <div className="w-full max-w-md animate-fade-in-up relative z-10">
                {/* Logo */}
                <div className="mb-6">
                    <Image src="/tass.png" alt="TAAS" width={120} height={40} className="h-10 w-auto" />
                </div>

                <div className="glass-card p-6">
                    <div className="mb-4">
                        <h2 className="text-xl font-medium mb-1">Connect Telegram</h2>
                        <p className="text-gray-500 text-sm">Set up your own bot and channel for unlimited storage</p>
                    </div>

                    {/* Instructions */}
                    <div className="mb-4 text-xs text-gray-500 space-y-1">
                        <p>1. Create a bot via <a href="https://t.me/BotFather" target="_blank" className="text-gray-400 hover:text-white inline-flex items-center gap-1">@BotFather <ArrowSquareOut weight="bold" className="w-3 h-3" /></a></p>
                        <p>2. Create a channel and add your bot as admin</p>
                        <p>3. Get channel ID (numeric ID starting with -100)</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label htmlFor="botToken" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                Bot Token
                            </label>
                            <input
                                id="botToken"
                                type="text"
                                value={botToken}
                                onChange={(e) => setBotToken(e.target.value)}
                                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="channelId" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                Channel ID
                            </label>
                            <input
                                id="channelId"
                                type="text"
                                value={channelId}
                                onChange={(e) => setChannelId(e.target.value)}
                                placeholder="-1001234567890"
                                required
                            />
                            <p className="text-xs text-gray-600 mt-1">Numeric ID starting with -100</p>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || isSkipping}
                            className="btn-primary w-full mt-4"
                        >
                            {isLoading ? (
                                <>
                                    <SpinnerGap weight="bold" className="w-5 h-5 animate-spin" />
                                    {step === 'validating' ? 'Validating...' : 'Connecting...'}
                                </>
                            ) : (
                                <>
                                    Connect
                                    <ArrowRight weight="bold" className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-[#0d1117] text-gray-500">or</span>
                        </div>
                    </div>

                    {/* Skip button */}
                    <button
                        onClick={handleSkip}
                        disabled={isLoading || isSkipping}
                        className="btn-secondary w-full flex items-center justify-center gap-2"
                    >
                        {isSkipping ? (
                            <>
                                <SpinnerGap weight="bold" className="w-5 h-5 animate-spin" />
                                <span>Setting up...</span>
                            </>
                        ) : (
                            <>
                                <SkipForward weight="bold" className="w-4 h-4" />
                                <span>Skip for now (100MB/file limit)</span>
                            </>
                        )}
                    </button>
                    <p className="text-xs text-gray-600 mt-2 text-center">
                        Use shared system bots with 100MB per file limit. You can set up your own bots later in Settings.
                    </p>
                </div>
            </div>
        </div>
    );
}
