import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const EmailConfirmedPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 max-w-md w-full"
            >
                <div className="bg-[#0A0A0C]/90 backdrop-blur-2xl border border-white/10 rounded-[40px] p-10 text-center shadow-2xl">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.2 }}
                        className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-emerald-500/20"
                    >
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </motion.div>

                    <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Email Confirmado!</h1>
                    <p className="text-gray-400 mb-8 leading-relaxed">
                        Sua conta foi ativada com sucesso. Agora você já pode acessar o ecossistema NeuroNex.
                    </p>

                    <Button
                        onClick={() => navigate('/auth')}
                        className="w-full h-12 rounded-xl bg-white text-black hover:bg-gray-100 font-bold uppercase tracking-widest text-xs shadow-lg shadow-white/5 transition-all active:scale-95"
                    >
                        Fazer Login
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};

export default EmailConfirmedPage;
