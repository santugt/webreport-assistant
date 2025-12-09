import React, { useState, useRef } from 'react';
import { Lock, Construction, AlertTriangle } from 'lucide-react';

interface MaintenanceScreenProps {
    onBypass: () => void;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({ onBypass }) => {
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordError, setPasswordError] = useState(false);

    // Secret Trigger Refs
    const clickCountRef = useRef(0);
    const lastClickRef = useRef(0);

    const handleSecretClick = (e: React.MouseEvent) => {
        e.preventDefault();

        const now = Date.now();
        // 800ms tolerance
        if (now - lastClickRef.current > 800) {
            clickCountRef.current = 0;
        }

        clickCountRef.current += 1;
        lastClickRef.current = now;

        // Trigger at 5 rapid clicks
        if (clickCountRef.current >= 5) {
            clickCountRef.current = 0;
            setIsPasswordModalOpen(true);
            setPasswordError(false);
        }
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordInput === "OPENTEXT") {
            onBypass();
        } else {
            setPasswordError(true);
        }
    };

    return (
        <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-white p-4 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600 rounded-full blur-[128px]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600 rounded-full blur-[128px]" />
            </div>

            <div className="max-w-md w-full text-center space-y-8 relative z-10">

                {/* Icon Wrapper with Secret Click */}
                <div
                    onClick={handleSecretClick}
                    className="w-24 h-24 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto shadow-2xl cursor-default active:scale-95 transition-transform select-none"
                    title="System Status: Locked"
                >
                    <Construction className="w-10 h-10 text-amber-500 animate-pulse" />
                </div>

                <div className="space-y-4">
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
                        Under Development
                    </h1>
                    <p className="text-zinc-400 text-lg leading-relaxed">
                        We are currently performing scheduled maintenance and upgrades. We'll be back shortly!
                    </p>
                </div>

                <div className="pt-8 border-t border-zinc-900">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900/50 rounded-full border border-zinc-800/50">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        <span className="text-xs font-medium text-zinc-500 tracking-wide uppercase">WebReport Assistant System</span>
                    </div>
                </div>
            </div>

            {/* Admin Bypass Modal */}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm ring-1 ring-white/5">
                        <div className="flex flex-col items-center mb-6 gap-3">
                            <div className="p-3 bg-blue-500/10 rounded-full">
                                <Lock className="w-6 h-6 text-blue-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-zinc-100">Admin Override</h3>
                        </div>

                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <input
                                    type="password"
                                    autoFocus
                                    value={passwordInput}
                                    onChange={(e) => {
                                        setPasswordInput(e.target.value);
                                        setPasswordError(false);
                                    }}
                                    placeholder="Enter Admin Password"
                                    className={`w-full bg-zinc-950 border ${passwordError ? 'border-red-500' : 'border-zinc-800'} focus:border-blue-500 text-white px-4 py-3 rounded-lg outline-none transition-all placeholder:text-zinc-600 text-center tracking-widest`}
                                />
                                {passwordError && (
                                    <p className="text-red-500 text-xs text-center flex items-center justify-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        Access Denied
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsPasswordModalOpen(false);
                                        setPasswordInput('');
                                        setPasswordError(false);
                                    }}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                                >
                                    Unlock
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
