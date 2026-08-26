import type { SynapseAgentIntegration } from '@/lib/synapse-agent-presentation';

const GmailLogo = () => (
  <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
    <path fill="#4285F4" d="M3.25 5.5 7 8.28v10.47H4.75a1.5 1.5 0 0 1-1.5-1.5V5.5Z" />
    <path fill="#34A853" d="M17 8.28 20.75 5.5v11.75a1.5 1.5 0 0 1-1.5 1.5H17V8.28Z" />
    <path fill="#FBBC04" d="M3.25 5.5 12 12l-1.76 2.08L3.25 8.9V5.5Z" />
    <path fill="#EA4335" d="M20.75 5.5V8.9L12 15.4 3.25 8.9V5.5L12 12l8.75-6.5Z" />
    <path fill="#C5221F" d="M20.75 5.5 12 12 3.25 5.5l1.14-.86a1.55 1.55 0 0 1 1.86 0L12 8.92l5.75-4.28a1.55 1.55 0 0 1 1.86 0l1.14.86Z" />
  </svg>
);

const GoogleCalendarLogo = () => (
  <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="3.2" fill="#fff" />
    <path fill="#4285F4" d="M7.2 3H18a3 3 0 0 1 3 3v10.8L17.2 21H6a3 3 0 0 1-3-3V7.2L7.2 3Z" />
    <path fill="#34A853" d="M3 16.8 7.2 21H18a3 3 0 0 0 3-3v-1.2H3Z" />
    <path fill="#FBBC04" d="M3 7.2V18a3 3 0 0 0 3 3h1.2V7.2H3Z" />
    <path fill="#EA4335" d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v1.2H3V6Z" />
    <rect x="7.2" y="7.2" width="13.8" height="9.6" fill="#fff" />
    <text x="14.1" y="14.45" textAnchor="middle" fontSize="6.9" fontWeight="800" fill="#4285F4" fontFamily="Arial, sans-serif">31</text>
  </svg>
);

export const SynapseIntegrationMark = ({
  integration,
  className = '',
}: {
  integration: SynapseAgentIntegration;
  className?: string;
}) => (
  <span
    className={`flex h-[19px] w-[19px] shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.16)] ring-1 ring-black/[0.06] ${className}`}
    title={integration === 'gmail' ? 'Gmail' : 'Google Agenda'}
  >
    {integration === 'gmail' ? <GmailLogo /> : <GoogleCalendarLogo />}
  </span>
);
