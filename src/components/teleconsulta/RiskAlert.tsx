import { AlertTriangle } from 'lucide-react';

interface RiskAlertProps {
  riskScore: number;
}

export const RiskAlert = ({ riskScore = 0 }: RiskAlertProps) => {
  const riskLevel = Math.min(100, Math.max(0, riskScore <= 10 ? riskScore * 10 : riskScore));
  if (riskLevel < 20) return null;

  return (
    <div className="absolute left-5 top-16 z-30 w-52 rounded-[16px] border border-rose-400/16 bg-black/72 px-3 py-2.5 text-white" role="status">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.14em] text-white/75">
          <AlertTriangle className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
          Risco monitorado
        </span>
        <span className="text-[9px] font-black text-rose-300">{Math.round(riskLevel)}%</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full origin-left rounded-full bg-rose-400 transition-transform duration-300 motion-reduce:transition-none"
          style={{ transform: `scaleX(${riskLevel / 100})` }}
        />
      </div>
    </div>
  );
};