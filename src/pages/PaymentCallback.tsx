"use client";

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Check, Loader2, AlertCircle, ArrowRight, Sparkles, Calendar, Users, CreditCard, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';

interface SessionData {
    plan_name: string;
    amount_total: number;
    subscription_id: string;
    status: string;
    is_paid: boolean;
    is_active: boolean;
    payment_confirmation_source?: string | null;
    message?: string;
}

const PaymentCallback = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'pending' | 'error'>('loading');
    const [sessionData, setSessionData] = useState<SessionData | null>(null);

    const sessionId = searchParams.get('session_id');
    const paymentStatus = searchParams.get('status');

    const showSuccess = useCallback(() => {
        setStatus('success');

        setTimeout(() => {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#ffffff', '#d4d4d4', '#a3a3a3', '#737373', '#525252']
            });
        }, 500);
    }, []);

    const waitForEntitlementActivation = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return false;

        for (let attempt = 0; attempt < 5; attempt += 1) {
            if (attempt > 0) {
                await new Promise((resolve) => setTimeout(resolve, 1800));
            }

            const { data } = await supabase.functions.invoke('get-current-entitlement', {
                body: {},
            });

            if (
                data?.status === 'active' &&
                data?.canUseCurrentAccess === true &&
                (
                    data?.paymentBackedAccess === true ||
                    data?.hasPaidAccess === true ||
                    data?.accessState === 'admin_override'
                )
            ) {
                return true;
            }
        }

        return false;
    }, []);

    const verifySession = useCallback(async () => {
        try {
            // Verify the payment session
            const { data, error } = await supabase.functions.invoke('verify-checkout-session', {
                body: { session_id: sessionId }
            });

            if (error) throw error;

            setSessionData(data);

            if (data?.is_paid === true || data?.status === 'paid') {
                showSuccess();
                return;
            }

            const activated = await waitForEntitlementActivation();
            if (activated) {
                showSuccess();
            } else {
                setStatus('pending');
            }

        } catch (error: any) {
            console.error('Session verification error:', error);
            setStatus('error');
        }
    }, [sessionId, showSuccess, waitForEntitlementActivation]);

    useEffect(() => {
        if (paymentStatus === 'success' && sessionId) {
            void verifySession();
        } else if (paymentStatus !== 'success') {
            setStatus('error');
        }
    }, [paymentStatus, sessionId, verifySession]);

    const handleContinue = async () => {
        // Check if user is already logged in
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            // User is logged in, go to dashboard
            navigate('/dashboard');
        } else {
            // User needs to create account or login - pass sessionId to link payment
            navigate('/create-account', { state: { sessionId } });
        }
    };

    const handleLogin = () => {
        navigate('/auth?role=pro');
    };

    const features = [
        { icon: Calendar, label: "Agenda Pro" },
        { icon: Users, label: "Pacientes" },
        { icon: Sparkles, label: "IA" }
    ];

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-white/10 blur-[60px] rounded-full" />
                    <Loader2 className="w-12 h-12 md:w-16 md:h-16 text-white/30 animate-spin relative z-10" />
                </div>
                <p className="text-[9px] md:text-[10px] font-black text-white/40 uppercase tracking-[0.3em] md:tracking-[0.4em] text-center">
                    Verificando Pagamento...
                </p>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative w-full max-w-md"
                >
                    <div className="bg-zinc-900/60 backdrop-blur-[60px] border border-white/10 rounded-[24px] md:rounded-[40px] p-6 md:p-10 text-center space-y-5 md:space-y-6">
                        <div className="w-14 h-14 md:w-16 md:h-16 bg-red-500/10 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto">
                            <AlertCircle className="w-7 h-7 md:w-8 md:h-8 text-red-400" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Erro no Pagamento</h2>
                            <p className="text-white/50 text-xs md:text-sm">
                                Não foi possível verificar seu pagamento. Por favor, tente novamente ou entre em contato conosco.
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                variant="outline"
                                onClick={() => navigate('/')}
                                className="flex-1 h-11 md:h-12 rounded-xl md:rounded-2xl border-white/10 text-white hover:bg-white/5 text-xs md:text-sm"
                            >
                                Voltar
                            </Button>
                            <Button
                                onClick={() => navigate('/#pricing')}
                                className="flex-1 h-11 md:h-12 rounded-xl md:rounded-2xl bg-white text-black hover:bg-white/90 text-xs md:text-sm"
                            >
                                Tentar Novamente
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (status === 'pending') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative w-full max-w-md"
                >
                    <div className="bg-zinc-900/60 backdrop-blur-[60px] border border-white/10 rounded-[24px] md:rounded-[40px] p-6 md:p-10 text-center space-y-5 md:space-y-6">
                        <div className="w-14 h-14 md:w-16 md:h-16 bg-amber-500/10 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto">
                            <Clock className="w-7 h-7 md:w-8 md:h-8 text-amber-300" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Pagamento em processamento</h2>
                            <p className="text-white/50 text-xs md:text-sm">
                                {sessionData?.message || "A liberacao acontece automaticamente apos a confirmacao da Asaas."}
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate('/dashboard')}
                            className="w-full h-11 md:h-12 rounded-xl md:rounded-2xl bg-white text-black hover:bg-white/90 text-xs md:text-sm"
                        >
                            Ir para o dashboard
                        </Button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-6 relative overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-white/[0.02] blur-[100px] md:blur-[150px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[250px] md:w-[500px] h-[250px] md:h-[500px] bg-white/[0.01] blur-[80px] md:blur-[120px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 w-full max-w-lg"
            >
                <div className="bg-zinc-900/60 backdrop-blur-[60px] border border-white/10 rounded-[28px] md:rounded-[48px] p-6 md:p-10 lg:p-14 relative overflow-hidden">
                    {/* Subtle highlight */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                    {/* Success Icon */}
                    <div className="flex justify-center mb-6 md:mb-8">
                        <div className="relative">
                            <div className="absolute inset-0 bg-white/20 blur-[30px] md:blur-[40px] rounded-full" />
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                className="relative w-16 h-16 md:w-20 md:h-20 bg-white rounded-[18px] md:rounded-[24px] flex items-center justify-center shadow-2xl shadow-white/10"
                            >
                                <Check className="w-8 h-8 md:w-10 md:h-10 text-black" strokeWidth={3} />
                            </motion.div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="text-center space-y-3 md:space-y-4 mb-6 md:mb-10">
                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-tighter"
                        >
                            Pagamento Confirmado!
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-white/50 text-xs md:text-sm lg:text-base px-2"
                        >
                            Sua assinatura {sessionData?.plan_name || 'NeuroNex Professional'} está ativa.
                            Vamos configurar seu perfil agora.
                        </motion.p>
                    </div>

                    {/* Payment Details Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-white/[0.03] border border-white/5 rounded-xl md:rounded-2xl p-4 md:p-5 mb-6 md:mb-8"
                    >
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-white/5 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                                <CreditCard className="w-5 h-5 md:w-6 md:h-6 text-white/40" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] text-white/30 mb-0.5 md:mb-1">
                                    Plano Ativo
                                </p>
                                <p className="text-base md:text-lg font-bold text-white truncate">
                                    {sessionData?.plan_name || 'Professional'}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-emerald-500/10 rounded-full">
                                    <span className="w-1 h-1 md:w-1.5 md:h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                    <span className="text-[8px] md:text-[9px] font-black uppercase tracking-wider text-emerald-400">
                                        Ativo
                                    </span>
                                </span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Feature Icons */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="flex justify-center gap-4 md:gap-6 mb-6 md:mb-10"
                    >
                        {features.map((feature, i) => (
                            <motion.div
                                key={feature.label}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.7 + i * 0.1 }}
                                className="flex flex-col items-center gap-1.5 md:gap-2 group"
                            >
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center transition-all group-hover:bg-white/[0.06]">
                                    <feature.icon className="w-4 h-4 md:w-5 md:h-5 text-white/40 group-hover:text-white/60 transition-colors" />
                                </div>
                                <span className="text-[6px] md:text-[7px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em] text-white/30">
                                    {feature.label}
                                </span>
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Action Buttons */}
                    <div className="space-y-2 md:space-y-3">
                        <Button
                            onClick={handleContinue}
                            className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-white text-black hover:bg-white/90 font-black uppercase text-[9px] md:text-[10px] tracking-[0.2em] md:tracking-[0.3em] shadow-xl shadow-white/5 transition-all active:scale-[0.98] group"
                        >
                            Configurar Minha Conta
                            <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>

                        <button
                            onClick={handleLogin}
                            className="w-full h-9 md:h-10 text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-white/30 hover:text-white/60 transition-colors"
                        >
                            Já tenho uma conta
                        </button>
                    </div>

                    {/* Email Notice */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                        className="text-center text-[9px] md:text-[10px] text-white/20 mt-4 md:mt-6"
                    >
                        Um email de confirmação foi enviado para você.
                    </motion.p>
                </div>
            </motion.div>
        </div>
    );
};

export default PaymentCallback;
