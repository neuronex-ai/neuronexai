import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBiofeedback } from '@/hooks/use-biofeedback';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, BrainCircuit, Heart, Loader2, Moon } from 'lucide-react';
import { useState } from 'react';
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface BiofeedbackWidgetProps {
    patientId: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl shadow-xl text-xs">
                <p className="font-bold text-zinc-300 mb-2">{format(parseISO(label), "dd 'de' MMMM", { locale: ptBR })}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 mb-1" style={{ color: entry.color }}>
                        <span className="capitalize">{entry.name}:</span>
                        <span className="font-mono font-bold">
                            {entry.value} {entry.unit}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export const BiofeedbackWidget = ({ patientId }: BiofeedbackWidgetProps) => {
    const { useCorrelations } = useBiofeedback(patientId);
    const { data: correlations, isLoading } = useCorrelations(30); // Últimos 30 dias
    const [activeTab, setActiveTab] = useState("overview");

    if (isLoading) {
        return (
            <Card className="bg-zinc-900/50 border-zinc-800 h-[400px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </Card>
        );
    }

    if (!correlations || correlations.length === 0) {
        return (
            <Card className="bg-zinc-900/50 border-zinc-800 h-[400px] flex flex-col items-center justify-center text-center p-6">
                <Activity className="w-12 h-12 text-zinc-700 mb-4" />
                <h3 className="text-lg font-medium text-zinc-300">Sem dados fisiológicos</h3>
                <p className="text-zinc-500 max-w-sm mt-2">
                    Conecte um dispositivo wearable (Apple Watch, Garmin) ao app do paciente para visualizar correlações entre sono, atividade e humor.
                </p>
            </Card>
        );
    }

    // Ordenar cronologicamente para o gráfico
    const chartData = [...correlations].reverse().map(d => ({
        ...d,
        formattedDate: d.date, // ISO Date string
    }));

    return (
        <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-medium text-zinc-100 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-purple-400" /> Biofeedback & Humor
                        </CardTitle>
                        <CardDescription>Correlação entre fisiologia e estados mentais (30 dias)</CardDescription>
                    </div>
                    <Tabs magnetic value={activeTab} onValueChange={setActiveTab} className="w-auto">
                        <TabsList className="bg-zinc-800/50 border border-zinc-700/50">
                            <TabsTrigger value="overview" className="text-xs">Visão Geral</TabsTrigger>
                            <TabsTrigger value="sleep" className="text-xs">Sono</TabsTrigger>
                            <TabsTrigger value="activity" className="text-xs">Atividade</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </CardHeader>

            <CardContent className="pt-4">
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        {activeTab === 'overview' ? (
                            <ComposedChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis
                                    dataKey="formattedDate"
                                    stroke="#52525b"
                                    tickFormatter={(val) => format(parseISO(val), 'dd/MM')}
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis yAxisId="left" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="right" orientation="right" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Area yAxisId="left" type="monotone" dataKey="avg_mood" name="Humor (1-5)" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMood)" strokeWidth={2} />
                                <Line yAxisId="right" type="monotone" dataKey="avg_sleep" name="Sono (min)" stroke="#06b6d4" strokeWidth={2} dot={false} />
                                <Line yAxisId="right" type="monotone" dataKey="avg_hrv" name="HRV (ms)" stroke="#ef4444" strokeWidth={2} dot={false} />
                            </ComposedChart>
                        ) : activeTab === 'sleep' ? (
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis
                                    dataKey="formattedDate"
                                    stroke="#52525b"
                                    tickFormatter={(val) => format(parseISO(val), 'dd/MM')}
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis yAxisId="left" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar yAxisId="left" dataKey="avg_sleep" name="Sono (min)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        ) : (
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis
                                    dataKey="formattedDate"
                                    stroke="#52525b"
                                    tickFormatter={(val) => format(parseISO(val), 'dd/MM')}
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis yAxisId="left" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar yAxisId="left" dataKey="avg_activity" name="Passos" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 flex flex-col items-center justify-center text-center">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
                            <BrainCircuit className="w-3.5 h-3.5 text-purple-400" /> Humor Médio
                        </div>
                        <span className="text-xl font-bold text-white">
                            {correlations.reduce((acc, curr) => acc + (curr.avg_mood || 0), 0) / correlations.filter(c => c.avg_mood).length || '-'}
                            <span className="text-xs text-zinc-500 font-normal ml-1">/5</span>
                        </span>
                    </div>

                    <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 flex flex-col items-center justify-center text-center">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
                            <Moon className="w-3.5 h-3.5 text-cyan-400" /> Sono Médio
                        </div>
                        <span className="text-xl font-bold text-white">
                            {Math.round(correlations.reduce((acc, curr) => acc + (curr.avg_sleep || 0), 0) / correlations.filter(c => c.avg_sleep).length / 60) || '-'}
                            <span className="text-xs text-zinc-500 font-normal ml-1">h</span>
                        </span>
                    </div>

                    <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 flex flex-col items-center justify-center text-center">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
                            <Heart className="w-3.5 h-3.5 text-red-400" /> HRV Médio
                        </div>
                        <span className="text-xl font-bold text-white">
                            {Math.round(correlations.reduce((acc, curr) => acc + (curr.avg_hrv || 0), 0) / correlations.filter(c => c.avg_hrv).length) || '-'}
                            <span className="text-xs text-zinc-500 font-normal ml-1">ms</span>
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
