import React, { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Battery, Home, FileText, Zap,
    ChevronRight, ChevronLeft, Loader2,
    CheckCircle2, TrendingUp, Wallet
} from 'lucide-react';

type InputMode = 'house' | 'bill';

const DEFAULT_STATE = {
    house: { occupants: 3, area_m2: 120, floors: 1 },
    bill: {
        monthly_avg: 350,
        consumption: {
            simple: 350,
            offPeak: 220,
            peak: 120,
            ponta: 80,
        },
        historyMonths: 1,
        history: [{ simple: 350, production: 0 }],
    },
    tariff: {
        type: 'simple',
        prices: {
            simple: 0.22,
            offPeak: 0.14,
            peak: 0.24,
            ponta: 0.10,
        }
    },
    solar: {
        has_solar: false,
        peak_kw: 4,
        country: 'Portugal',
        city: 'Lisboa'
    }
};

export default function Simulator() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<InputMode | null>(null);
    const [results, setResults] = useState<any>(null);

    // Prevenção de crash: Merge seguro com localStorage
    const [formData, setFormData] = useState(() => {
        try {
            const saved = localStorage.getItem('simulator_v2');
            if (!saved) return DEFAULT_STATE;
            const parsed = JSON.parse(saved);
            const parsedHistory = parsed.bill?.history || DEFAULT_STATE.bill.history;
            const history = parsedHistory.map((entry: any) => {
                if (typeof entry === 'number') {
                    return { simple: entry, production: 0 };
                }
                return { ...entry, production: entry.production ?? 0 };
            });

            return {
                house: { ...DEFAULT_STATE.house, ...(parsed.house || {}) },
                bill: { ...DEFAULT_STATE.bill, ...(parsed.bill || {}), history },
                tariff: {
                    ...DEFAULT_STATE.tariff,
                    ...(parsed.tariff || {}),
                    prices: {
                        ...DEFAULT_STATE.tariff.prices,
                        ...(parsed.tariff?.prices || {})
                    }
                },
                solar: { ...DEFAULT_STATE.solar, ...(parsed.solar || {}) }
            };
        } catch {
            return DEFAULT_STATE;
        }
    });

    useEffect(() => {
        localStorage.setItem('simulator_v2', JSON.stringify(formData));
    }, [formData]);

    const normalizeHistoryEntry = (entry: any, type: string) => {
        if (!entry || typeof entry !== 'object') {
            if (type === 'tri') return { offPeak: 0, peak: 0, ponta: 0, production: 0 };
            if (type === 'bi') return { offPeak: 0, peak: 0, production: 0 };
            return { simple: 0, production: 0 };
        }

        if (type === 'simple') {
            return { simple: entry.simple ?? entry.offPeak ?? entry.peak ?? entry.ponta ?? 0, production: entry.production ?? 0 };
        }

        if (type === 'bi') {
            return {
                offPeak: entry.offPeak ?? entry.simple ?? 0,
                peak: entry.peak ?? entry.simple ?? 0,
                production: entry.production ?? 0,
            };
        }

        return {
            offPeak: entry.offPeak ?? entry.simple ?? 0,
            peak: entry.peak ?? 0,
            ponta: entry.ponta ?? entry.superOffPeak ?? 0,
            production: entry.production ?? 0,
        };
    };

    const createHistoryEntry = (type: string, value = 0) => {
        if (type === 'tri') return { offPeak: value, peak: value, ponta: value, production: 0 };
        if (type === 'bi') return { offPeak: value, peak: value, production: 0 };
        return { simple: value, production: 0 };
    };

    const runSimulation = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/simulator/size', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode,
                    input: mode === 'house' ? formData.house : formData.bill,
                    tariff: formData.tariff,
                    solar: formData.solar,
                    assumptions: { battery_dod: 0.9, system_losses: 0.1 }
                }),
            });

            if (!response.ok) throw new Error("Erro na API");

            const data = await response.json();
            setResults(data);
            setStep(3);
        } catch (error) {
            console.error("Erro na simulação:", error);
            alert("Erro ao calcular. Verifica a conexão com o backend.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-white text-black">
            <Navigation />

            <main className="flex-grow py-12">
                <div className="max-w-4xl mx-auto px-4">

                    {/* Progress Header */}
                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                            Simulador de Independência Energética
                        </h1>
                        <p className="mt-3 text-lg text-gray-500">
                            Descubra o sistema de baterias ideal para a sua casa em menos de 2 minutos.
                        </p>
                    </div>

                    {/* Stepper Visual */}
                    <div className="flex items-center justify-center mb-12 space-x-4">
                        {[1, 2, 3].map((i) => (
                            <React.Fragment key={i}>
                                <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${step >= i ? 'bg-orange-600 text-white' : 'bg-white text-gray-300 border-2 border-gray-200'}`}>
                                    {step > i ? <CheckCircle2 className="w-6 h-6" /> : i}
                                </div>
                                {i < 3 && <div className={`w-12 h-1 ${step > i ? 'bg-orange-600' : 'bg-gray-200'}`} />}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Step 1: Selection */}
                    {step === 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
                            <Card
                                onClick={() => { setMode('house'); setStep(2); }}
                                className={`cursor-pointer border-2 transition-all hover:shadow-lg ${mode === 'house' ? 'border-orange-600 bg-orange-50/50' : 'border-gray-200 hover:border-black'}`}
                            >
                                <CardContent className="p-8 text-center">
                                    <div className="bg-orange-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Home className="text-white w-8 h-8" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Pelas características da casa</h3>
                                    <p className="text-gray-500 text-sm">Não tenho a fatura comigo, quero estimar pelo número de pessoas e características da casa.</p>
                                </CardContent>
                            </Card>

                            <Card
                                onClick={() => { setMode('bill'); setStep(2); }}
                                className={`cursor-pointer border-2 transition-all hover:shadow-lg ${mode === 'bill' ? 'border-orange-600 bg-orange-50/50' : 'border-gray-200 hover:border-black'}`}
                            >
                                <CardContent className="p-8 text-center">
                                    <div className="bg-orange-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <FileText className="text-white w-8 h-8" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Pelo valor da fatura</h3>
                                    <p className="text-gray-500 text-sm">Tenho o meu consumo mensal em kWh e quero usar o tarifário correto.</p>
                                </CardContent>
                            </Card>

                            <Card className="md:col-span-2 opacity-50 bg-gray-50 border-dashed border-2 border-gray-300">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Zap className="text-gray-400" />
                                        <span className="font-medium text-gray-500">Importação automática E-Redes</span>
                                    </div>
                                    <Badge variant="outline" className="border-gray-300 text-gray-500">Brevemente</Badge>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Step 2: Form */}
                    {step === 2 && (
                        <Card className="shadow-xl border-gray-200 animate-in slide-in-from-bottom-4 duration-500">
                            <CardHeader>
                                <CardTitle>Configuração de Consumo</CardTitle>
                                <CardDescription className="text-gray-500">Ajuste os valores para uma simulação precisa.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {mode === 'house' ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <Label>Nº de pessoas na habitação</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                className="border-gray-300 focus-visible:ring-orange-600"
                                                value={formData.house.occupants}
                                                onChange={(e) => setFormData({ ...formData, house: { ...formData.house, occupants: Number(e.target.value) } })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Área aproximada (m²)</Label>
                                            <Input
                                                type="number"
                                                min="10"
                                                className="border-gray-300 focus-visible:ring-orange-600"
                                                value={formData.house.area_m2}
                                                onChange={(e) => setFormData({ ...formData, house: { ...formData.house, area_m2: Number(e.target.value) } })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Nº de pisos</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                className="border-gray-300 focus-visible:ring-orange-600"
                                                value={formData.house.floors}
                                                onChange={(e) => setFormData({ ...formData, house: { ...formData.house, floors: Number(e.target.value) } })}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-0">
                                    </div>
                                )}

                                <div className="pt-4 border-t border-gray-200">
                                    <Label className="text-gray-400 text-xs uppercase tracking-widest">Tarifário</Label>
                                    <div className="mt-4 space-y-4">
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { key: 'simple', label: 'Simples' },
                                                { key: 'bi', label: 'Bi-horário' },
                                                { key: 'tri', label: 'Tri-horário' }
                                            ].map((option) => (
                                                <Button
                                                    key={option.key}
                                                    className={`text-sm h-12 ${formData.tariff.type === option.key ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border border-gray-200 text-black hover:bg-gray-100'}`}
                                                    onClick={() => setFormData({
                                                        ...formData,
                                                        tariff: { ...formData.tariff, type: option.key as 'simple' | 'bi' | 'tri' },
                                                        bill: { ...formData.bill, history: formData.bill.history.map((entry: any) => normalizeHistoryEntry(entry, option.key)) }
                                                    })}
                                                >
                                                    {option.label}
                                                </Button>
                                            ))}
                                        </div>

                                    </div>
                                </div>


                                <div className="pt-4 border-t border-gray-200">
                                    <div className="grid gap-4 md:grid-cols-3">
                                        {formData.tariff.type === 'simple' && (
                                            <div className="space-y-2 md:col-span-1">
                                                <Label>Preço simples (€/kWh)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                    value={formData.tariff.prices.simple}
                                                    onChange={(e) => setFormData({ ...formData, tariff: { ...formData.tariff, prices: { ...formData.tariff.prices, simple: Number(e.target.value) } } })}
                                                />
                                            </div>
                                        )}

                                        {formData.tariff.type === 'bi' && (
                                            <>
                                                <div className="space-y-2">
                                                    <Label>Preço vazio (€/kWh)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        className="border-gray-300 focus-visible:ring-orange-600"
                                                        value={formData.tariff.prices.offPeak}
                                                        onChange={(e) => setFormData({ ...formData, tariff: { ...formData.tariff, prices: { ...formData.tariff.prices, offPeak: Number(e.target.value) } } })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Preço cheia (€/kWh)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        className="border-gray-300 focus-visible:ring-orange-600"
                                                        value={formData.tariff.prices.peak}
                                                        onChange={(e) => setFormData({ ...formData, tariff: { ...formData.tariff, prices: { ...formData.tariff.prices, peak: Number(e.target.value) } } })}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {formData.tariff.type === 'tri' && (
                                            <>
                                                <div className="space-y-2">
                                                    <Label>Preço vazio (€/kWh)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        className="border-gray-300 focus-visible:ring-orange-600"
                                                        value={formData.tariff.prices.offPeak}
                                                        onChange={(e) => setFormData({ ...formData, tariff: { ...formData.tariff, prices: { ...formData.tariff.prices, offPeak: Number(e.target.value) } } })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Preço cheia (€/kWh)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        className="border-gray-300 focus-visible:ring-orange-600"
                                                        value={formData.tariff.prices.peak}
                                                        onChange={(e) => setFormData({ ...formData, tariff: { ...formData.tariff, prices: { ...formData.tariff.prices, peak: Number(e.target.value) } } })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Preço de ponta (€/kWh)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        className="border-gray-300 focus-visible:ring-orange-600"
                                                        value={formData.tariff.prices.ponta}
                                                        onChange={(e) => setFormData({ ...formData, tariff: { ...formData.tariff, prices: { ...formData.tariff.prices, ponta: Number(e.target.value) } } })}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>


                                <div className="pt-4 border-t border-gray-200 space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div>
                                            <Label className="mb-1">Tem painéis solares?</Label>
                                            <p className="text-sm text-gray-500">Se tiver, adicionamos perfil de produção mais preciso.</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 sm:w-auto">
                                            <Button
                                                className={`h-12 ${formData.solar.has_solar ? 'bg-white border border-gray-200 text-black hover:bg-gray-100' : 'bg-orange-600 text-white hover:bg-orange-700'}`}
                                                onClick={() => setFormData({ ...formData, solar: { ...formData.solar, has_solar: false } })}
                                            >
                                                Não
                                            </Button>
                                            <Button
                                                className={`h-12 ${formData.solar.has_solar ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border border-gray-200 text-black hover:bg-gray-100'}`}
                                                onClick={() => setFormData({ ...formData, solar: { ...formData.solar, has_solar: true } })}
                                            >
                                                Sim
                                            </Button>
                                        </div>
                                    </div>

                                    {formData.solar.has_solar && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label>Potência de pico instalada (kW)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                    value={formData.solar.peak_kw}
                                                    onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, peak_kw: Number(e.target.value) } })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>País</Label>
                                                <Input
                                                    type="text"
                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                    value={formData.solar.country}
                                                    onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, country: e.target.value } })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Cidade</Label>
                                                <Input
                                                    type="text"
                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                    value={formData.solar.city}
                                                    onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, city: e.target.value } })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {mode === 'bill' && (
                                    <div className="pt-4 border-t border-gray-200 space-y-4">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label>Meses de histórico</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max="12"
                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                    value={formData.bill.historyMonths}
                                                    onChange={(e) => {
                                                        const months = Math.min(12, Math.max(1, Number(e.target.value) || 1));
                                                        const history = [...formData.bill.history];
                                                        if (history.length < months) {
                                                            history.push(...Array(months - history.length).fill(null).map(() => createHistoryEntry(formData.tariff.type)));
                                                        } else {
                                                            history.length = months;
                                                        }
                                                        setFormData({ ...formData, bill: { ...formData.bill, historyMonths: months, history } });
                                                    }}
                                                />
                                                <p className="text-sm text-gray-500">Até 12 meses de consumo anteriores para maior precisão.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {formData.bill.history.slice(0, formData.bill.historyMonths).map((entry: any, index: number) => (
                                                <div key={index} className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                                                    <div className="font-semibold mb-3">Mês {index + 1}</div>
                                                    <div className={`grid gap-4 ${formData.tariff.type === 'tri' ? (formData.solar.has_solar ? 'md:grid-cols-4' : 'md:grid-cols-3') : formData.tariff.type === 'bi' ? (formData.solar.has_solar ? 'md:grid-cols-3' : 'md:grid-cols-2') : (formData.solar.has_solar ? 'md:grid-cols-2' : 'md:grid-cols-1')}`}>
                                                        {formData.tariff.type === 'simple' && (
                                                            <div className="space-y-2">
                                                                <Label>Consumo (kWh)</Label>
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                                    value={entry.simple ?? ''}
                                                                    onChange={(e) => {
                                                                        const history = [...formData.bill.history];
                                                                        history[index] = { ...history[index], simple: Number(e.target.value) };
                                                                        setFormData({ ...formData, bill: { ...formData.bill, history } });
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                        {formData.tariff.type !== 'simple' && (
                                                            <>
                                                                <div className="space-y-2">
                                                                    <Label>Vazio (kWh)</Label>
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        className="border-gray-300 focus-visible:ring-orange-600"
                                                                        value={entry.offPeak ?? ''}
                                                                        onChange={(e) => {
                                                                            const history = [...formData.bill.history];
                                                                            history[index] = { ...history[index], offPeak: Number(e.target.value) };
                                                                            setFormData({ ...formData, bill: { ...formData.bill, history } });
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>Cheia (kWh)</Label>
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        className="border-gray-300 focus-visible:ring-orange-600"
                                                                        value={entry.peak ?? ''}
                                                                        onChange={(e) => {
                                                                            const history = [...formData.bill.history];
                                                                            history[index] = { ...history[index], peak: Number(e.target.value) };
                                                                            setFormData({ ...formData, bill: { ...formData.bill, history } });
                                                                        }}
                                                                    />
                                                                </div>
                                                                {formData.tariff.type === 'tri' && (
                                                                    <div className="space-y-2">
                                                                        <Label>Ponta (kWh)</Label>
                                                                        <Input
                                                                            type="number"
                                                                            min="0"
                                                                            className="border-gray-300 focus-visible:ring-orange-600"
                                                                            value={entry.ponta ?? ''}
                                                                            onChange={(e) => {
                                                                                const history = [...formData.bill.history];
                                                                                history[index] = { ...history[index], ponta: Number(e.target.value) };
                                                                                setFormData({ ...formData, bill: { ...formData.bill, history } });
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                        {formData.solar.has_solar && (
                                                            <div className="space-y-2">
                                                                <Label>Produção solar (kWh)</Label>
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                                    value={entry.production ?? ''}
                                                                    onChange={(e) => {
                                                                        const history = [...formData.bill.history];
                                                                        history[index] = { ...history[index], production: Number(e.target.value) };
                                                                        setFormData({ ...formData, bill: { ...formData.bill, history } });
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <Button variant="outline" className="border-gray-300 text-black hover:bg-gray-100" onClick={() => setStep(1)}>
                                        <ChevronLeft className="mr-2 w-4 h-4" /> Voltar
                                    </Button>
                                    <Button className="flex-grow bg-orange-600 hover:bg-orange-700 text-white h-12 text-lg" onClick={runSimulation} disabled={loading}>
                                        {loading ? <Loader2 className="animate-spin mr-2" /> : "Gerar Recomendação"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Step 3: Results */}
                    {step === 3 && results && (
                        <div className="space-y-8 animate-in zoom-in-95 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {results.recommendations.map((rec: any, idx: number) => (
                                    <Card key={idx} className={`relative overflow-hidden transition-all hover:scale-105 bg-white ${idx === 0 ? 'border-orange-600 border-2 shadow-xl' : 'border-gray-200'}`}>
                                        {idx === 0 && (
                                            <div className="absolute top-0 right-0 bg-orange-600 text-white px-3 py-1 text-xs font-bold rounded-bl-lg">
                                                MELHOR ESCOLHA
                                            </div>
                                        )}
                                        <CardHeader className="pb-2">
                                            <Badge className="w-fit mb-2 bg-black text-white hover:bg-black">{rec.battery.brand}</Badge>
                                            <CardTitle className="text-xl">{rec.battery.model}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex items-baseline gap-1 border-b border-gray-100 pb-4">
                                                <span className="text-3xl font-extrabold">{rec.capex_total_eur.toLocaleString()}€</span>
                                                <span className="text-gray-400 text-sm">est.</span>
                                            </div>

                                            <div className="space-y-3 pt-2">
                                                <div className="flex items-center text-sm text-black">
                                                    <TrendingUp className="w-4 h-4 mr-2 text-orange-600" />
                                                    <span>Poupança: <strong>{rec.savings_annual_eur}€/ano</strong></span>
                                                </div>
                                                <div className="flex items-center text-sm text-black">
                                                    <Wallet className="w-4 h-4 mr-2 text-orange-600" />
                                                    <span>Payback: <strong>{rec.payback_years} anos</strong></span>
                                                </div>
                                            </div>

                                            <Button className={`w-full mt-4 ${idx === 0 ? 'bg-black text-white hover:bg-gray-800' : 'bg-white border-2 border-black text-black hover:bg-gray-50'}`}>
                                                Solicitar Orçamento
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-sm text-gray-500">
                                <h4 className="font-bold text-black mb-2">Notas da Simulação:</h4>
                                <ul className="list-disc ml-4 space-y-1">
                                    <li>Eficiência do sistema considerada: 90%.</li>
                                    <li>Os valores de capex são estimativos e não incluem instalação.</li>
                                </ul>
                            </div>

                            <div className="text-center">
                                <Button variant="link" onClick={() => setStep(1)} className="text-gray-500 hover:text-black">Refazer Simulação</Button>
                            </div>
                        </div>
                    )}

                    {/* Waiting List Section */}
                    <section className="mt-24 p-10 bg-orange-50 rounded-3xl text-black relative overflow-hidden">
                        <div className="relative z-10 max-w-xl">
                            <h2 className="text-2xl font-bold mb-4">Deseja um Relatório Técnico Completo?</h2>
                            <p className="text-gray-700 mb-6">A nossa equipa realiza um estudo detalhado de sombreamento e perfil de carga específico para a sua empresa ou habitação.</p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Input placeholder="Seu email principal" className="bg-white border-gray-200 text-black placeholder:text-gray-400 focus-visible:ring-orange-600" />
                                <Button className="bg-orange-600 hover:bg-orange-700 px-8 text-white">Receber PDF</Button>
                            </div>
                        </div>
                        <Battery className="absolute -right-10 -bottom-10 w-64 h-64 text-orange-200/20 rotate-12" />
                    </section>

                </div>
            </main>

            <Footer />
        </div>
    );
}