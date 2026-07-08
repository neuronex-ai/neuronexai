import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

interface PublicAppointment {
  id: string;
  user_id: string;
  token?: string | null;
  start_time: string;
  end_time: string;
  status: string;
  auth_code?: string | null;
  price?: number | null;
  payment_config?: {
    type?: string;
    paymentType?: string;
  } | null;
  metadata?: Record<string, unknown> | null;
  professional?: {
    name?: string | null;
    clinic?: string | null;
    avatar_url?: string | null;
  };
  profiles?: {
    full_name: string;
    avatar_url: string;
  };
}

type PublicAppointmentAction = 'confirm' | 'reschedule' | 'cancel';
type Step = 'identity' | 'decision' | 'payment' | 'confirmed' | 'rescheduled' | 'cancelled';

const AVAILABLE_TIMES = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

const isCancelled = (status?: string | null) => ['cancelled', 'canceled', 'cancelled_by_patient', 'cancelled_by_professional'].includes(String(status || '').toLowerCase());
const isConfirmed = (status?: string | null) => ['confirmed', 'attended', 'completed', 'unscored'].includes(String(status || '').toLowerCase());

const professionalName = (appointment?: PublicAppointment | null) =>
  appointment?.professional?.name || appointment?.profiles?.full_name || 'Seu Psicólogo';

const professionalAvatar = (appointment?: PublicAppointment | null) =>
  appointment?.professional?.avatar_url || appointment?.profiles?.avatar_url || '';

const appointmentSummary = (appointment: PublicAppointment) =>
  `${format(new Date(appointment.start_time), "dd 'de' MMMM", { locale: ptBR })} às ${format(new Date(appointment.start_time), 'HH:mm')}`;

export default function SecureConfirmAppointment() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('identity');
  const [appointment, setAppointment] = useState<PublicAppointment | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  const tokenValue = token || '';
  const canSkipCode = !appointment?.auth_code;

  const loadAppointment = useCallback(async (options?: { silent?: boolean }) => {
    if (!tokenValue || tokenValue === 'invalid') {
      setAppointment(null);
      setInitialLoading(false);
      return null;
    }

    if (!options?.silent) setInitialLoading(true);
    const { data, error } = await supabase.functions.invoke<{
      appointment: PublicAppointment;
      professional?: PublicAppointment['professional'];
    }>('get-appointment-by-token', { body: { token: tokenValue } });

    if (error || !data?.appointment) {
      if (!options?.silent) toast.error('Link de convite inválido ou expirado.');
      setInitialLoading(false);
      return null;
    }

    const nextAppointment = {
      ...data.appointment,
      professional: data.professional || data.appointment.professional,
    };
    setAppointment(nextAppointment);
    if (isCancelled(nextAppointment.status)) setStep('cancelled');
    else if (isConfirmed(nextAppointment.status) && step !== 'rescheduled') setStep('confirmed');
    setInitialLoading(false);
    return nextAppointment;
  }, [step, tokenValue]);

  useEffect(() => {
    void loadAppointment();
  }, [loadAppointment]);

  useEffect(() => {
    if (!appointment?.id) return;

    const channel = supabase
      .channel(`public-appointment-${appointment.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `id=eq.${appointment.id}` },
        () => void loadAppointment({ silent: true }),
      )
      .subscribe();

    const interval = window.setInterval(() => void loadAppointment({ silent: true }), 7000);
    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [appointment?.id, loadAppointment]);

  const confirmIdentity = () => {
    if (canSkipCode || authCode.toUpperCase() === String(appointment?.auth_code || '').toUpperCase()) {
      setStep('decision');
      toast.success('Identidade confirmada.');
      return;
    }

    toast.error('Código incorreto. Verifique o convite recebido.');
  };

  const launchConfetti = () => {
    const end = Date.now() + 2200;
    const frame = () => {
      confetti({ particleCount: 4, spread: 55, origin: { x: 0.2 } });
      confetti({ particleCount: 4, spread: 55, origin: { x: 0.8 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };

  const createPayment = async (currentAppointment: PublicAppointment) => {
    if (!currentAppointment.price) return null;

    const { data, error } = await supabase.functions.invoke('asaas-create-payment', {
      body: {
        amount: Math.round(currentAppointment.price * 100),
        description: `Sessão com ${professionalName(currentAppointment)}`,
        appointment_id: currentAppointment.id,
        payment_methods: ['pix'],
        expires_in_minutes: 60,
      },
    });

    if (error) throw error;
    return data as { checkout_url?: string; payment_id?: string } | null;
  };

  const runAppointmentAction = async (
    action: PublicAppointmentAction,
    payload?: { newStartTime?: string; newEndTime?: string },
  ) => {
    if (!appointment || !tokenValue) return null;

    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      event: 'confirmed' | 'cancelled' | 'rescheduled';
      appointment: PublicAppointment;
    }>('process-public-appointment', {
      body: { token: tokenValue, action, ...payload },
    });

    if (error || !data?.success) throw new Error(error?.message || 'Não foi possível processar o agendamento.');
    const nextAppointment = { ...appointment, ...data.appointment };
    setAppointment(nextAppointment);
    return nextAppointment;
  };

  const confirmAppointment = async () => {
    if (!appointment) return;
    setLoading(true);
    try {
      const updatedAppointment = await runAppointmentAction('confirm');
      if (!updatedAppointment) return;

      const requiresPayment =
        updatedAppointment.payment_config?.type === 'charge' ||
        updatedAppointment.payment_config?.paymentType === 'charge';

      if (requiresPayment && updatedAppointment.price) {
        const payment = await createPayment(updatedAppointment);
        const reference = payment?.checkout_url || payment?.payment_id || '';
        setPaymentReference(reference);
        if (typeof reference === 'string' && reference.startsWith('http')) {
          window.location.href = reference;
          return;
        }
        setStep('payment');
        return;
      }

      setStep('confirmed');
      launchConfetti();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível confirmar a consulta.');
    } finally {
      setLoading(false);
    }
  };

  const rescheduleAppointment = async () => {
    if (!appointment || !selectedDate || !selectedTime) {
      toast.error('Selecione data e horário.');
      return;
    }

    const start = new Date(selectedDate);
    const [hours, minutes] = selectedTime.split(':').map(Number);
    start.setHours(hours, minutes, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + Math.max(30, Math.round((new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()) / 60000) || 50));

    setLoading(true);
    try {
      await runAppointmentAction('reschedule', {
        newStartTime: start.toISOString(),
        newEndTime: end.toISOString(),
      });
      setStep('rescheduled');
      toast.success('Pedido de reagendamento enviado.');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível reagendar.');
    } finally {
      setLoading(false);
    }
  };

  const cancelAppointment = async () => {
    setLoading(true);
    try {
      await runAppointmentAction('cancel');
      setStep('cancelled');
      toast.success('Consulta cancelada.');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível cancelar.');
    } finally {
      setLoading(false);
    }
  };

  const statusMessage = useMemo(() => {
    if (!appointment) return '';
    if (isCancelled(appointment.status)) return 'Este agendamento está cancelado.';
    if (isConfirmed(appointment.status)) return 'Este agendamento já está confirmado.';
    if (appointment.status === 'pending') return 'Este agendamento está aguardando revisão.';
    return 'Escolha como deseja seguir com esta consulta.';
  }, [appointment]);

  if (initialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-9 w-9 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <Card className="max-w-md rounded-[32px] border-border bg-card/70 p-8 shadow-2xl backdrop-blur-2xl">
          <XCircle className="mx-auto h-14 w-14 text-rose-500" />
          <h1 className="mt-5 text-2xl font-black">Link inválido ou expirado</h1>
          <p className="mt-2 text-sm text-muted-foreground">Solicite um novo convite ao seu psicólogo.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 md:p-8">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-full max-w-4xl -translate-x-1/2 bg-primary/5 blur-[120px]" />
      <div className="relative z-10 w-full max-w-[500px]">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight">Portal do Paciente</h1>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Agendamento seguro</p>
        </div>

        <Card className="overflow-hidden rounded-[32px] border-border bg-card/70 shadow-2xl backdrop-blur-2xl">
          <CardContent className="p-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                className="p-8 md:p-10"
              >
                {step === 'identity' ? (
                  <div className="space-y-7 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                      <Lock className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Código de acesso</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {canSkipCode ? 'Este link já está validado. Continue para revisar a consulta.' : 'Digite o código recebido.'}
                      </p>
                    </div>
                    {!canSkipCode ? (
                      <Input
                        value={authCode}
                        maxLength={5}
                        onChange={(event) => setAuthCode(event.target.value.toUpperCase())}
                        className="h-20 rounded-2xl text-center font-mono text-3xl font-black tracking-[0.5em]"
                      />
                    ) : null}
                    <Button onClick={confirmIdentity} className="h-14 w-full rounded-2xl">
                      Continuar <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                ) : null}

                {step === 'decision' ? (
                  <div className="space-y-7">
                    <div className="flex items-center gap-4 rounded-2xl border bg-muted/40 p-4">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-background">
                        {professionalAvatar(appointment) ? (
                          <img src={professionalAvatar(appointment)} alt="Profissional" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-6 w-6" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-primary">Convite de</p>
                        <p className="truncate font-bold">{professionalName(appointment)}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-background/60 p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Consulta atual</p>
                      <p className="mt-2 text-lg font-black">{appointmentSummary(appointment)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{statusMessage}</p>
                    </div>

                    <div className="grid gap-3">
                      <Button disabled={loading} onClick={confirmAppointment} className="h-14 rounded-2xl">
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar consulta</>}
                      </Button>
                      <Button disabled={loading} variant="outline" onClick={() => setStep('rescheduled')} className="h-14 rounded-2xl">
                        <RotateCcw className="mr-2 h-4 w-4" /> Quero reagendar
                      </Button>
                      <Button disabled={loading} variant="outline" onClick={cancelAppointment} className="h-14 rounded-2xl border-rose-500/25 text-rose-600 hover:bg-rose-500/10">
                        <XCircle className="mr-2 h-4 w-4" /> Cancelar consulta
                      </Button>
                    </div>
                  </div>
                ) : null}

                {step === 'rescheduled' && !isCancelled(appointment.status) && appointment.status !== 'pending' ? (
                  <div className="space-y-7">
                    <div>
                      <h2 className="text-2xl font-bold">Escolha um novo horário</h2>
                      <p className="mt-2 text-sm text-muted-foreground">O psicólogo será notificado e o pedido ficará pendente de revisão.</p>
                    </div>
                    <div>
                      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-muted-foreground"><CalendarDays className="h-4 w-4" /> Data</p>
                      <div className="flex justify-center rounded-2xl border p-3">
                        <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} locale={ptBR} />
                      </div>
                    </div>
                    <div>
                      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-muted-foreground"><Clock className="h-4 w-4" /> Horário</p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {AVAILABLE_TIMES.map((time) => (
                          <button
                            key={time}
                            type="button"
                            onClick={() => setSelectedTime(time)}
                            className={`h-10 rounded-xl border text-xs font-bold ${selectedTime === time ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <Button disabled={loading || !selectedTime} onClick={rescheduleAppointment} className="h-14 rounded-2xl">
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Solicitar reagendamento'}
                      </Button>
                      <Button disabled={loading} variant="ghost" onClick={() => setStep('decision')} className="h-12 rounded-2xl">Voltar</Button>
                    </div>
                  </div>
                ) : null}

                {step === 'payment' && paymentReference ? (
                  <div className="space-y-7 text-center">
                    <ShieldCheck className="mx-auto h-16 w-16 text-emerald-500" />
                    <h2 className="text-2xl font-bold">Pagamento iniciado</h2>
                    <p className="text-sm text-muted-foreground">A cobrança foi criada. Conclua o pagamento para finalizar.</p>
                  </div>
                ) : null}

                {step === 'confirmed' ? (
                  <div className="space-y-7 py-5 text-center">
                    <CheckCircle2 className="mx-auto h-24 w-24 text-emerald-500" />
                    <h2 className="text-3xl font-black">Confirmado!</h2>
                    <p className="text-sm text-muted-foreground">{appointmentSummary(appointment)}</p>
                    <Button variant="secondary" onClick={() => navigate('/')} className="h-14 w-full rounded-2xl">Voltar ao portal</Button>
                  </div>
                ) : null}

                {step === 'rescheduled' && appointment.status === 'pending' ? (
                  <div className="space-y-7 py-5 text-center">
                    <RotateCcw className="mx-auto h-20 w-20 text-amber-500" />
                    <h2 className="text-3xl font-black">Pedido enviado</h2>
                    <p className="text-sm text-muted-foreground">Seu pedido de reagendamento foi enviado para {professionalName(appointment)}.</p>
                    <p className="rounded-2xl border bg-muted/40 p-4 text-sm font-semibold">Novo horário solicitado: {appointmentSummary(appointment)}</p>
                    <Button variant="secondary" onClick={() => navigate('/portal')} className="h-14 w-full rounded-2xl">Voltar ao portal</Button>
                  </div>
                ) : null}

                {step === 'cancelled' ? (
                  <div className="space-y-7 py-5 text-center">
                    <XCircle className="mx-auto h-20 w-20 text-rose-500" />
                    <h2 className="text-3xl font-black">Consulta cancelada</h2>
                    <p className="text-sm text-muted-foreground">O profissional foi notificado sobre o cancelamento.</p>
                    <Button variant="secondary" onClick={() => navigate('/portal')} className="h-14 w-full rounded-2xl">Voltar ao portal</Button>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
