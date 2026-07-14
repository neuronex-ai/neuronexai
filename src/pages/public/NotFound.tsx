import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Texture */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[150px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="max-w-xl w-full text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="space-y-12"
        >
          <div className="relative inline-block">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-8 border border-white/[0.05] border-dashed rounded-full"
            />
            <div className="w-32 h-32 rounded-[40px] bg-white/[0.02] border border-white/[0.08] flex items-center justify-center shadow-2xl relative">
              <Sparkles className="w-10 h-10 text-white/40" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-[120px] font-bold text-white tracking-tighter leading-none opacity-20">404</h1>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tighter">Espaço Não Localizado</h2>
            <p className="text-zinc-500 font-medium text-lg max-w-sm mx-auto tracking-tight">
              As coordenadas fornecidas não correspondem a nenhuma interface ativa no NeuroNex.
            </p>
          </div>

          <div className="pt-4">
            <Link to="/">
              <div className="h-16 px-12 rounded-full bg-white text-black font-black text-xs uppercase tracking-[0.4em] transition-all hover:scale-105 active:scale-95 shadow-2xl flex items-center gap-4 mx-auto group cursor-pointer justify-center">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-2 transition-transform" />
                Retornar à Base
              </div>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
