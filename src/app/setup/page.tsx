'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
    ArrowRight,
    SpinnerGap,
    CheckCircle,
    ArrowSquareOut
} from '@phosphor-icons/react';
import { telegramApi } from '@/lib/api';

export default function SetupPage() {
    const router = useRouter();

    const [botToken, setBotToken] = useState('');
    const [channelId, setChannelId] = useState('');
    const [apiId, setApiId] = useState('');
    const [apiHash, setApiHash] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'form' | 'validating' | 'success'>('form');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        setStep('validating');

        try {
            await telegramApi.setup(botToken, channelId, apiId, apiHash);
            const validateResponse = await telegramApi.validate();

            if (validateResponse.data.valid) {
                setStep('success');
                setTimeout(() => {
                    router.push('/dashboard');
                }, 2000);
            } else {
                throw new Error(validateResponse.data.error || 'Validation failed');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to setup Telegram');
            setStep('form');
        } finally {
            setIsLoading(false);
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
                        <p className="text-gray-500 text-sm">Configure your bot and channel</p>
                    </div>

                    {/* Instructions */}
                    <div className="mb-4 text-xs text-gray-500 space-y-1">
                        <p>1. Create a bot via <a href="https://t.me/BotFather" target="_blank" className="text-gray-400 hover:text-white inline-flex items-center gap-1">@BotFather <ArrowSquareOut weight="bold" className="w-3 h-3" /></a></p>
                        <p>2. Create a channel and add your bot as admin</p>
                        <p>3. Get API credentials from <a href="https://my.telegram.org" target="_blank" className="text-gray-400 hover:text-white inline-flex items-center gap-1">my.telegram.org <ArrowSquareOut weight="bold" className="w-3 h-3" /></a></p>
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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label htmlFor="apiId" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    API ID
                                </label>
                                <input
                                    id="apiId"
                                    type="text"
                                    value={apiId}
                                    onChange={(e) => setApiId(e.target.value)}
                                    placeholder="12345678"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="apiHash" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    API Hash
                                </label>
                                <input
                                    id="apiHash"
                                    type="text"
                                    value={apiHash}
                                    onChange={(e) => setApiHash(e.target.value)}
                                    placeholder="abc123..."
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
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
                </div>
            </div>
        </div>
    );
}
