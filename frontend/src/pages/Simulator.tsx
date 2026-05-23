import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { getApiUrl } from '@/lib/config';
import { useAuth } from '@/context/AuthContext';
import { useAppMode } from '@/context/AppModeContext';
import { useToast } from '@/hooks/use-toast';
import RecommendationModal from '@/components/RecommendationModal';
// @ts-ignore
import coverPdfAsset from '@/assets/Watt Builder_Cover.pdf';
import {
    Battery, Home, FileText, Zap, Sun, Car,
    ChevronRight, ChevronLeft, Loader2,
    CheckCircle2, TrendingUp, Wallet, Plus, Trash2, Star
} from 'lucide-react';

type InputMode = 'house' | 'bill';
type TariffType = 'simple' | 'bi' | 'tri';
type TariffPeriod = 'simple' | 'offPeak' | 'peak' | 'ponta';

const DEFAULT_TARIFF_PRICES: Record<TariffPeriod, number> = {
    simple: 0.22,
    offPeak: 0.14,
    peak: 0.24,
    ponta: 0.30,
};

const TARIFF_PERIODS: Record<TariffType, Array<{ key: TariffPeriod; label: string }>> = {
    simple: [{ key: 'simple', label: 'Consumo' }],
    bi: [
        { key: 'offPeak', label: 'Vazio' },
        { key: 'peak', label: 'Cheia' },
    ],
    tri: [
        { key: 'offPeak', label: 'Vazio' },
        { key: 'peak', label: 'Cheia' },
        { key: 'ponta', label: 'Ponta' },
    ],
};

const getTariffPeriods = (tariffType: string) => TARIFF_PERIODS[(tariffType as TariffType) || 'simple'] || TARIFF_PERIODS.simple;

const roundTariffPrice = (value: number) => Number(value.toFixed(4));

const getDefaultTariffPrices = (tariffType: string) => {
    return getTariffPeriods(tariffType).reduce((prices, period) => {
        prices[period.key] = DEFAULT_TARIFF_PRICES[period.key];
        return prices;
    }, {} as Record<string, number>);
};

const estimateTariffPricesFromLastBill = (tariffType: string, lastBill: any) => {
    const periods = getTariffPeriods(tariffType);
    const defaults = getDefaultTariffPrices(tariffType);
    const total = Number(lastBill?.total ?? 0);
    const consumption = lastBill?.consumption || {};
    const kwhByPeriod = periods.reduce((values, period) => {
        values[period.key] = Math.max(0, Number(consumption[period.key] ?? 0));
        return values;
    }, {} as Record<string, number>);
    const totalKwh = Object.values(kwhByPeriod).reduce((sum, value) => sum + value, 0);

    if (total <= 0 || totalKwh <= 0) return defaults;

    if (tariffType === 'simple') {
        return { simple: roundTariffPrice(total / totalKwh) };
    }

    const defaultBillTotal = periods.reduce((sum, period) => {
        return sum + kwhByPeriod[period.key] * (defaults[period.key] ?? 0);
    }, 0);

    if (defaultBillTotal <= 0) {
        const averagePrice = roundTariffPrice(total / totalKwh);
        return periods.reduce((prices, period) => {
            prices[period.key] = averagePrice;
            return prices;
        }, {} as Record<string, number>);
    }

    const scale = total / defaultBillTotal;
    return periods.reduce((prices, period) => {
        prices[period.key] = roundTariffPrice((defaults[period.key] ?? 0) * scale);
        return prices;
    }, {} as Record<string, number>);
};

const getHouseTariffPrices = (tariffType: string, house: any) => {
    if (house?.use_last_bill) {
        return estimateTariffPricesFromLastBill(tariffType, house.last_bill);
    }

    return getDefaultTariffPrices(tariffType);
};

const getBillTariffPrices = (tariffType: string, bill: any) => {
    const periods = getTariffPeriods(tariffType);
    const months = Math.max(1, Number(bill?.historyMonths ?? 1));
    const history = (bill?.history || []).slice(0, months);
    const aggregateBill = {
        total: 0,
        consumption: periods.reduce((values, period) => {
            values[period.key] = 0;
            return values;
        }, {} as Record<string, number>),
    };

    history.forEach((entry: any) => {
        if (!entry || typeof entry !== 'object') return;
        aggregateBill.total += Math.max(0, Number(entry.bill_total ?? entry.total ?? 0));
        periods.forEach((period) => {
            aggregateBill.consumption[period.key] += Math.max(0, Number(entry[period.key] ?? 0));
        });
    });

    return estimateTariffPricesFromLastBill(tariffType, aggregateBill);
};

const getBillMonthTariffPrices = (tariffType: string, entry: any) => {
    const periods = getTariffPeriods(tariffType);
    const monthBill = {
        total: Math.max(0, Number(entry?.bill_total ?? entry?.total ?? 0)),
        consumption: periods.reduce((values, period) => {
            values[period.key] = Math.max(0, Number(entry?.[period.key] ?? 0));
            return values;
        }, {} as Record<string, number>),
    };

    return estimateTariffPricesFromLastBill(tariffType, monthBill);
};

const formatTariffPrice = (value: number) => `${Number(value || 0).toFixed(3)} €/kWh`;

const parseStepParam = (value: string | null) => {
    if (value === 'input') return 2;
    if (value === 'results') return 3;
    return 1;
};

const parseModeParam = (value: string | null): InputMode | null => {
    return value === 'house' || value === 'bill' ? value : null;
};

const DEFAULT_STATE = {
    house: {
        occupants: 3,
        area_m2: 120,
        floors: 1,
        use_last_bill: false,
        last_bill: {
            total: 0,
            consumption: {
                simple: 350,
                offPeak: 220,
                peak: 120,
                ponta: 80,
            },
        },
    },
    bill: {
        monthly_avg: 350,
        consumption: {
            simple: 350,
            offPeak: 220,
            peak: 120,
            ponta: 80,
        },
        historyMonths: 1,
        history: [{ simple: 350, bill_total: 0, production: 0 }],
    },
    tariff: {
        type: 'simple',
        prices: {
            ...DEFAULT_TARIFF_PRICES,
        }
    },
    solar: {
        has_solar: false,
        peak_kw: 4,
        country: 'Portugal',
        city: 'Lisboa',
        location: '',
        grid_type: 'all',
        existing_inverter_brand: '',
        existing_inverter_model: '',
        existing_inverter_max_power_kw: 0,
        has_battery: false,
        battery_capacity_kwh: 0,
        existing_battery_brand: '',
        existing_battery_model: '',
        existing_battery_max_power_kw: 0,
        expand_solar: true
    },
    max_investment: '',
    electric_vehicles: {
        has_electric_vehicle: false,
        count: 0,
        vehicles: []
    }
};

export default function Simulator() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { isAuthenticated, token, user } = useAuth();
    const { isAdminMode } = useAppMode();
    const { toast } = useToast();
    const [step, setStep] = useState(() => parseStepParam(searchParams.get('step')));
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<InputMode | null>(() => parseModeParam(searchParams.get('mode')));
    const [results, setResults] = useState<any>(null);
    const [selectedRecommendation, setSelectedRecommendation] = useState<any>(null);
    const [reportEmail, setReportEmail] = useState('');
    const [isSendingReportEmail, setIsSendingReportEmail] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [isSendingFeedback, setIsSendingFeedback] = useState(false);
    const [userRating, setUserRating] = useState<number | null>(null);
    const [ratingComment, setRatingComment] = useState('');
    const [isSendingRating, setIsSendingRating] = useState(false);
    const [hasRated, setHasRated] = useState(false);

    const handleNumericChange = (value: string, fieldLabel: string, callback: (val: number) => void) => {
        if (value === '') {
            callback(0);
            return;
        }
        
        // Allow typing the minus sign without immediately triggering NaN or negative check
        if (value === '-') return;

        const num = Number(value);
        if (isNaN(num)) return;

        if (num < 0) {
            toast({
                title: 'Valor Inválido',
                description: `O valor para "${fieldLabel}" não pode ser negativo. Por favor, corrija o valor.`,
                variant: 'destructive',
            });
            return;
        }
        callback(num);
    };

    const handleRatingSubmit = async (rating: number, comment?: string, isFinal: boolean = false) => {
        setIsSendingRating(true);
        try {
            const response = await fetch(getApiUrl('send-contact-email'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Avaliação de Soluções',
                    email: user?.email || 'anonimo@watt-builder.com',
                    subject: 'Nova Avaliação de Soluções WattBuilder',
                    message: [
                        'Avaliação recebida no simulador',
                        '',
                        `Classificação: ${rating} / 10 estrelas`,
                        comment ? `Comentário: ${comment}` : 'Sem comentário adicional.',
                        isFinal ? 'Submissão Final' : 'Submissão Parcial (apenas nota)',
                        '',
                        '--- Contexto do Utilizador ---',
                        `- Email do utilizador: ${user?.email || 'não indicado'}`,
                        '',
                        getSimulationContextSummary(),
                    ].join('\n'),
                }),
            });

            if (!response.ok) {
                throw new Error('Erro no envio da avaliação');
            }

            if (isFinal) {
                if (comment) {
                    toast({
                        title: 'Obrigado!',
                        description: 'A sua avaliação e comentário foram enviados com sucesso.',
                    });
                }
                setHasRated(true);
            }
        } catch (error) {
            console.error('Erro ao enviar avaliação:', error);
            if (isFinal) {
                toast({
                    title: 'Erro ao enviar avaliação',
                    description: 'Tente novamente mais tarde.',
                    variant: 'destructive',
                });
            }
        } finally {
            setIsSendingRating(false);
        }
    };

    const handleSendReportEmail = async () => {
        if (!reportEmail.trim()) {
            alert('Por favor, insira um email.');
            return;
        }

        setIsSendingReportEmail(true);
        try {
            const response = await fetch(getApiUrl('send-contact-email'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Relatório Tecnico Completo',
                    email: reportEmail.trim(),
                    subject: 'Pedido de Relatório Tecnico Completo',
                    message: [
                        'O utilizador solicitou um relatório técnico completo.',
                        '',
                        `Email para contacto: ${reportEmail.trim()}`,
                        '',
                        getSimulationContextSummary(),
                    ].join('\n'),
                }),
            });

            if (!response.ok) {
                throw new Error('Erro no envio do email');
            }

            alert('Pedido enviado! Iremos responder em breve.');
            setReportEmail('');
        } catch (error) {
            console.error('Erro no envio de relatório:', error);
            alert('Erro ao enviar o pedido. Verifique o email ou tente novamente mais tarde.');
        } finally {
            setIsSendingReportEmail(false);
        }
    };

    const handleSendFeedback = async () => {
        const trimmedFeedback = feedbackMessage.trim();
        if (!trimmedFeedback) {
            toast({
                title: 'Feedback vazio',
                description: 'Por favor, escreva o seu feedback antes de enviar.',
                variant: 'destructive',
            });
            return;
        }

        setIsSendingFeedback(true);
        try {
            const response = await fetch(getApiUrl('send-contact-email'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Feedback Simulador',
                    email: user?.email || reportEmail.trim() || 'anonimo@watt-builder.com',
                    subject: 'Feedback Simulador WattBuilder',
                    message: [
                        'Feedback recebido no simulador',
                        '',
                        'Mensagem:',
                        trimmedFeedback,
                        '',
                        '--- Contexto do Utilizador ---',
                        `- Modo de input: ${mode || 'não selecionado'}`,
                        `- Email do utilizador: ${user?.email || reportEmail.trim() || 'não indicado'}`,
                        '',
                        getSimulationContextSummary(),
                    ].join('\n'),
                }),
            });

            if (!response.ok) {
                throw new Error('Erro no envio do feedback');
            }

            toast({
                title: 'Feedback enviado',
                description: 'Obrigado pela ajuda. A sua mensagem foi recebida pela equipa WattBuilder.',
            });
            setFeedbackMessage('');
        } catch (error) {
            console.error('Erro ao enviar feedback:', error);
            toast({
                title: 'Erro ao enviar feedback',
                description: 'Tente novamente mais tarde.',
                variant: 'destructive',
            });
        } finally {
            setIsSendingFeedback(false);
        }
    };

    const getSimulationContextSummary = () => {
        if (!mode) return 'Nenhuma simulação iniciada.';

        const lines = [];
        lines.push('--- DADOS DA SIMULAÇÃO (INPUT) ---');
        lines.push(`Modo: ${mode === 'house' ? 'Dimensionamento por Casa' : 'Dimensionamento por Fatura'}`);

        if (mode === 'house') {
            lines.push(`Ocupantes: ${formData.house.occupants}`);
            lines.push(`Área: ${formData.house.area_m2} m2`);
            lines.push(`Andares: ${formData.house.floors}`);
        } else if (mode === 'bill') {
            lines.push(`Média Mensal: ${formData.bill.monthly_avg} €`);
            lines.push(`Meses de Histórico: ${formData.bill.historyMonths}`);
        }

        lines.push(`Tarifa: ${formData.tariff.type}`);
        lines.push(`Localização: ${formData.solar.location ? formData.solar.location + ', ' : ''}${formData.solar.city}, ${formData.solar.country}`);
        lines.push(`Rede: ${formData.solar.grid_type === 'single_phase' ? 'Monofásica' : formData.solar.grid_type === 'three_phase' ? 'Trifásica' : 'Não indicada'}`);

        if (formData.solar.has_solar) {
            lines.push(`Solar: Sim (${formData.solar.peak_kw} kWp)`);
            if (formData.solar.has_battery) {
                lines.push(`Bateria Existente: Sim (${formData.solar.battery_capacity_kwh} kWh)`);
            }
        } else {
            lines.push('Solar: Não');
        }

        if (formData.electric_vehicles.has_electric_vehicle) {
            lines.push(`Veículos Elétricos: Sim (${formData.electric_vehicles.count})`);
        }

        lines.push(`Investimento Máximo: ${formData.max_investment || 'Não definido'} €`);

        if (results && (results.recommendations || results.results)) {
            lines.push('');
            lines.push('--- RESULTADOS GERADOS ---');
            const recommendations = results.recommendations || results.results || [];
            recommendations.slice(0, 3).forEach((rec: any, i: number) => {
                const label = rec.label || rec.type || `Solução ${i + 1}`;
                lines.push(`Recomendação ${i + 1}: ${label}`);
                if (rec.battery) {
                    lines.push(`  Bateria: ${rec.battery.brand} ${rec.battery.model} (${rec.battery.capacity_kwh} kWh)`);
                }
                if (rec.financials) {
                    lines.push(`  Payback: ${rec.financials.payback_years?.toFixed(1)} anos`);
                    lines.push(`  Poupança Anual: ${rec.financials.annual_savings?.toFixed(0)} €`);
                }
            });
        }

        // Adicionar o JSON bruto no final para referência técnica completa
        lines.push('');
        lines.push('--- DADOS BRUTOS (JSON) ---');
        lines.push(JSON.stringify(formData, null, 2));

        return lines.join('\n');
    };

    const [formData, setFormData] = useState(() => {
        try {
            const saved = localStorage.getItem('simulator_v2');
            if (!saved) return DEFAULT_STATE;
            const parsed = JSON.parse(saved);
            const parsedHistory = parsed.bill?.history || DEFAULT_STATE.bill.history;
            const history = parsedHistory.map((entry: any) => {
                if (typeof entry === 'number') {
                    return { simple: entry, bill_total: 0, production: 0 };
                }
                return { ...entry, bill_total: entry.bill_total ?? entry.total ?? 0, production: entry.production ?? 0 };
            });
            const parsedHouse = parsed.house || {};
            const parsedLastBill = parsedHouse.last_bill || {};

            return {
                house: {
                    ...DEFAULT_STATE.house,
                    ...parsedHouse,
                    last_bill: {
                        ...DEFAULT_STATE.house.last_bill,
                        ...parsedLastBill,
                        consumption: {
                            ...DEFAULT_STATE.house.last_bill.consumption,
                            ...(parsedLastBill.consumption || {}),
                        },
                    },
                },
                bill: { ...DEFAULT_STATE.bill, ...(parsed.bill || {}), history },
                tariff: {
                    ...DEFAULT_STATE.tariff,
                    ...(parsed.tariff || {}),
                    prices: {
                        ...DEFAULT_STATE.tariff.prices,
                        ...(parsed.tariff?.prices || {})
                    }
                },
                solar: { ...DEFAULT_STATE.solar, ...(parsed.solar || {}) },
                max_investment: parsed.max_investment ?? DEFAULT_STATE.max_investment,
                electric_vehicles: normalizeElectricVehicles(parsed.electric_vehicles || DEFAULT_STATE.electric_vehicles)
            };
        } catch {
            return DEFAULT_STATE;
        }
    });

    useEffect(() => {
        localStorage.setItem('simulator_v2', JSON.stringify(formData));
    }, [formData]);

    const goToStep = (
        nextStep: number,
        nextMode: InputMode | null = mode,
        options: { replace?: boolean } = {},
    ) => {
        setStep(nextStep);
        if (nextMode) setMode(nextMode);

        const params = new URLSearchParams(searchParams);
        if (nextStep === 1) {
            params.delete('step');
            params.delete('mode');
        } else {
            params.set('step', nextStep === 3 ? 'results' : 'input');
            if (nextMode) params.set('mode', nextMode);
            else params.delete('mode');
        }

        setSearchParams(params, { replace: options.replace ?? false });
    };

    const canOpenStep = (targetStep: number) => {
        if (targetStep === 1) return true;
        if (targetStep === 2) return Boolean(mode);
        return Boolean(results);
    };

    const handleStepperClick = (targetStep: number) => {
        if (!canOpenStep(targetStep)) return;
        goToStep(targetStep, mode);
    };

    useEffect(() => {
        const urlStep = parseStepParam(searchParams.get('step'));
        const urlMode = parseModeParam(searchParams.get('mode'));

        if (urlStep === 3 && !results) {
            goToStep(urlMode ? 2 : 1, urlMode, { replace: true });
            return;
        }

        if (urlStep !== step) setStep(urlStep);
        if (urlMode && urlMode !== mode) setMode(urlMode);
    }, [searchParams]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const pending = localStorage.getItem('simulator_pending_auth');
        if (!pending) return;

        try {
            const parsed = JSON.parse(pending);
            if (parsed.formData) setFormData(parsed.formData);
            if (parsed.mode) setMode(parsed.mode);
            goToStep(2, parsed.mode || mode, { replace: true });
        } catch {
        } finally {
            localStorage.removeItem('simulator_pending_auth');
        }
    }, [isAuthenticated]);

    const normalizeHistoryEntry = (entry: any, type: string) => {
        const billTotal = entry?.bill_total ?? entry?.total ?? 0;
        if (!entry || typeof entry !== 'object') {
            if (type === 'tri') return { offPeak: 0, peak: 0, ponta: 0, bill_total: 0, production: 0 };
            if (type === 'bi') return { offPeak: 0, peak: 0, bill_total: 0, production: 0 };
            return { simple: 0, bill_total: 0, production: 0 };
        }

        if (type === 'simple') {
            return { simple: entry.simple ?? entry.offPeak ?? entry.peak ?? entry.ponta ?? 0, bill_total: billTotal, production: entry.production ?? 0 };
        }

        if (type === 'bi') {
            return {
                offPeak: entry.offPeak ?? entry.simple ?? 0,
                peak: entry.peak ?? entry.simple ?? 0,
                bill_total: billTotal,
                production: entry.production ?? 0,
            };
        }

        return {
            offPeak: entry.offPeak ?? entry.simple ?? 0,
            peak: entry.peak ?? 0,
            ponta: entry.ponta ?? entry.superOffPeak ?? 0,
            bill_total: billTotal,
            production: entry.production ?? 0,
        };
    };

    const createHistoryEntry = (type: string, value = 0) => {
        if (type === 'tri') return { offPeak: value, peak: value, ponta: value, bill_total: 0, production: 0 };
        if (type === 'bi') return { offPeak: value, peak: value, bill_total: 0, production: 0 };
        return { simple: value, bill_total: 0, production: 0 };
    };

    function normalizeElectricVehicles(evData: any) {
        const sourceVehicles = evData?.vehicles || [];
        const count = Math.max(0, Number(evData?.count ?? sourceVehicles.length ?? 0));
        const vehicles = Array.from({ length: count }, (_, index) => {
            const vehicle = sourceVehicles[index] || {};
            return {
                brand: vehicle.brand || '',
                model: vehicle.model || '',
                daily_km: Number(vehicle.daily_km ?? 30),
                consumption_kwh_per_km: Number(vehicle.consumption_kwh_per_km ?? 0.18),
                charging_schedule: vehicle.charging_schedule || 'night',
            };
        });

        return {
            has_electric_vehicle: Boolean(evData?.has_electric_vehicle) && count > 0,
            count,
            vehicles,
        };
    }

    const createDefaultElectricVehicle = () => ({
        brand: '',
        model: '',
        daily_km: 30,
        consumption_kwh_per_km: 0.18,
        charging_schedule: 'night',
    });

    const updateElectricVehicleCount = (count: number) => {
        const normalizedCount = Math.max(0, Math.min(6, Number(count) || 0));
        setFormData({
            ...formData,
            electric_vehicles: normalizeElectricVehicles({
                ...formData.electric_vehicles,
                has_electric_vehicle: normalizedCount > 0,
                count: normalizedCount,
            }),
        });
    };

    const updateElectricVehicle = (index: number, field: string, value: string | number) => {
        const vehicles = [...formData.electric_vehicles.vehicles];
        vehicles[index] = { ...vehicles[index], [field]: value };
        setFormData({
            ...formData,
            electric_vehicles: normalizeElectricVehicles({
                ...formData.electric_vehicles,
                vehicles,
            }),
        });
    };

    const addElectricVehicle = () => {
        const vehicles = [...formData.electric_vehicles.vehicles, createDefaultElectricVehicle()].slice(0, 6);
        setFormData({
            ...formData,
            electric_vehicles: normalizeElectricVehicles({
                has_electric_vehicle: true,
                count: vehicles.length,
                vehicles,
            }),
        });
    };

    const removeElectricVehicle = (index: number) => {
        const vehicles = formData.electric_vehicles.vehicles.filter((_: any, vehicleIndex: number) => vehicleIndex !== index);
        setFormData({
            ...formData,
            electric_vehicles: normalizeElectricVehicles({
                has_electric_vehicle: vehicles.length > 0,
                count: vehicles.length,
                vehicles,
            }),
        });
    };

    const runSimulation = async () => {
        if (!isAuthenticated || !token) {
            localStorage.setItem('simulator_pending_auth', JSON.stringify({ step, mode, formData }));
            navigate('/login?redirect=/simulator');
            return;
        }

        // --- VALIDATION SAFEGUARD ---
        const errors: string[] = [];
        
        // Basic House Info
        if (formData.house.occupants < 0) errors.push('Nº de pessoas');
        if (formData.house.area_m2 < 0) errors.push('Área aproximada');
        if (formData.house.floors < 0) errors.push('Nº de pisos');

        // Mode specific validation
        if (mode === 'house' && formData.house.use_last_bill) {
            const consumption = formData.house.last_bill.consumption;
            Object.keys(consumption).forEach(key => {
                if (consumption[key as keyof typeof consumption] < 0) {
                    errors.push(`Consumo ${key}`);
                }
            });
            if (formData.house.last_bill.total < 0) errors.push('Valor total da fatura');
        } else if (mode === 'bill') {
            formData.bill.history.slice(0, formData.bill.historyMonths).forEach((entry: any, i: number) => {
                if (entry.simple < 0) errors.push(`Mês ${i+1}: Consumo`);
                if (entry.offPeak < 0) errors.push(`Mês ${i+1}: Vazio`);
                if (entry.peak < 0) errors.push(`Mês ${i+1}: Cheia`);
                if (entry.ponta < 0) errors.push(`Mês ${i+1}: Ponta`);
                if (entry.bill_total < 0) errors.push(`Mês ${i+1}: Valor da fatura`);
                if (entry.production < 0) errors.push(`Mês ${i+1}: Produção solar`);
            });
        }

        // Solar & Battery Validation
        if (formData.solar.has_solar) {
            if (formData.solar.peak_kw < 0) errors.push('Potência de pico existente');
            if (formData.solar.existing_inverter_max_power_kw < 0) errors.push('Potência máxima do inversor');
            if (formData.solar.has_battery) {
                if (formData.solar.battery_capacity_kwh < 0) errors.push('Capacidade da bateria atual');
                if (formData.solar.existing_battery_max_power_kw < 0) errors.push('Potência máxima da bateria atual');
            }
        }

        // EV Validation
        if (formData.electric_vehicles.has_electric_vehicle) {
            formData.electric_vehicles.vehicles.forEach((v: any, i: number) => {
                if (v.daily_km < 0) errors.push(`Carro ${i+1}: Km por dia`);
                if (v.consumption_kwh_per_km < 0) errors.push(`Carro ${i+1}: Consumo`);
            });
        }

        // Investment Validation
        if (formData.max_investment !== '' && Number(formData.max_investment) < 0) {
            errors.push('Investimento Máximo');
        }

        if (errors.length > 0) {
            toast({
                title: 'Valores Inválidos Encontrados',
                description: `Por favor, corrija os valores negativos nos seguintes campos: ${errors.join(', ')}.`,
                variant: 'destructive',
            });
            return;
        }
        // --- END VALIDATION ---

        // Reset rating state for new simulation
        setHasRated(false);
        setUserRating(null);
        setRatingComment('');

        setLoading(true);
        try {
            const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
            const tariffPrices = mode === 'house'
                ? getHouseTariffPrices(formData.tariff.type, formData.house)
                : getBillTariffPrices(formData.tariff.type, formData.bill);
            const tariffPayload = {
                type: formData.tariff.type,
                prices: tariffPrices,
            };
            const response = await fetch(getApiUrl('api/simulator/size'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    mode,
                    input: {
                        ...(mode === 'house' ? formData.house : formData.bill),
                        site: {
                            area_m2: formData.house.area_m2,
                            floors: formData.house.floors,
                            occupants: formData.house.occupants,
                        },
                        electric_vehicles: formData.electric_vehicles,
                    },
                    tariff: tariffPayload,
                    solar: formData.solar,
                    max_investment: formData.max_investment ? Number(formData.max_investment) : null,
                    assumptions: { battery_dod: 0.9, system_losses: 0.1, component_margin: 0.1, installation_margin: 0.25 },
                    form_data: formData,
                    client_timezone: clientTimezone,
                }),
            });

            if (response.status === 401) {
                localStorage.setItem('simulator_pending_auth', JSON.stringify({ step, mode, formData }));
                navigate('/login?redirect=/simulator');
                return;
            }

            if (!response.ok) throw new Error("Erro na API");

            const data = await response.json();
            setResults(data);
            goToStep(3, mode);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            console.error("Erro na simulação:", error);
            alert("Erro ao calcular. Verifica a conexão com o backend.");
        } finally {
            setLoading(false);
        }
    };

    function getBatteryDescription(recommendation: any) {
        const battery = recommendation?.battery || {};
        const quantity = Number(battery.quantity || 1);
        const prefix = quantity > 1 ? `${quantity} x ` : '';
        return `${prefix}${battery.brand || ''} ${battery.model || ''}`.trim();
    }

    const handleRequestQuote = (recommendation: any) => {
        const products = [];
        if (recommendation.battery) {
            products.push(`Bateria: ${getBatteryDescription(recommendation)}`);
        }
        if (recommendation.existing_battery?.has_battery) {
            products.push(`Bateria existente considerada: ${getExistingBatteryDescription(recommendation.existing_battery)}`);
        }
        if (recommendation.inverter) {
            products.push(`Inversor: ${recommendation.inverter.brand} ${recommendation.inverter.model}`);
        }
        if (recommendation.solar_panels) {
            if (recommendation.solar_panels.expanded) {
                products.push(`Painéis solares existentes: ${recommendation.solar_panels.existing_power_kwp} kWp`);
                products.push(`Reforço solar: ${recommendation.solar_panels.quantity} x ${recommendation.solar_panels.panel.brand} ${recommendation.solar_panels.panel.model} (${recommendation.solar_panels.added_power_kwp} kWp adicionais)`);
            } else if (recommendation.solar_panels.existing) {
                products.push(`Painéis solares existentes: ${recommendation.solar_panels.array_power_kwp} kWp`);
            } else {
                products.push(`Painéis solares: ${recommendation.solar_panels.quantity} x ${recommendation.solar_panels.panel.brand} ${recommendation.solar_panels.panel.model}`);
            }
        }
        if (recommendation.replacement_notes?.length) {
            products.push(...recommendation.replacement_notes.map((note: string) => `Nota: ${note}`));
        }

        const body = `Olá, \ngostaria de solicitar um orçamento para a instalação dos seguintes produtos sugeridos pela simulação:\n\n${products.join('\n')}\n\nLocal da casa: ${formData.solar.city}, ${formData.house.area_m2} m²\n\nObrigado.`;
        const subject = 'Solicitação de Orçamento para instalação';

        // Removemos o localStorage e o window.location.href
        // Codificamos as strings para garantir que quebras de linha (\n) e caracteres especiais não quebram o URL
        const encodedMessage = encodeURIComponent(body);
        const encodedSubject = encodeURIComponent(subject);

        // Usamos o React Router para manter a navegação suave (SPA)
        navigate(`/contact?subject=${encodedSubject}&message=${encodedMessage}`);
    };

    const budgetSections = [
        {
            tier: 'budget',
            title: 'Budget',
            description: 'Opções com menor investimento inicial.',
            badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        },
        {
            tier: 'balanced',
            title: 'Balanced',
            description: 'A solução mais equilibrada: maximiza o seu autoconsumo e poupança mantendo um investimento controlado.',
            badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
        },
        {
            tier: 'premium',
            title: 'Premium',
            description: 'Sistemas com mais capacidade e margem de crescimento.',
            badgeClass: 'bg-black text-white border-black',
        },
    ];

    const recommendationGroups = budgetSections.map((section) => ({
        ...section,
        items: (results?.recommendations || []).filter((rec: any) => rec.budget_tier === section.tier),
    }));

    const formatPrice = (value: any) => `${Math.round(Number(value || 0)).toLocaleString()}€`;

    const getPriceBreakdown = (recommendation: any) => {
        const componentPrices = recommendation?.component_prices_eur || {};
        const battery = componentPrices.battery ?? recommendation?.battery?.pricing?.unit_price ?? 0;
        const inverter = componentPrices.inverter ?? recommendation?.inverter?.pricing?.unit_price ?? 0;
        const solarPanels = componentPrices.solar_panels ?? recommendation?.solar_panels?.total_price_eur ?? 0;
        const hardwareTotal = componentPrices.hardware_total ?? recommendation?.hardware_total_eur ?? (battery + inverter + solarPanels);

        // Mantemos o cálculo mas a instalação será "0" para o frontend por agora
        const installation = 0;

        return {
            hardwareTotal,
            installation,
        };
    };

    const getSystemName = (recommendation: any) => {
        if (recommendation?.system_name) return recommendation.system_name;
        return `${recommendation?.battery?.brand || ''} ${recommendation?.battery?.model || ''}`.trim();
    };

    const getSolarDescription = (solarPanels: any) => {
        if (!solarPanels) return 'Sem painéis solares incluídos';
        if (solarPanels.expanded) {
            return `Existentes ${solarPanels.existing_power_kwp} kWp + ${solarPanels.quantity} x ${solarPanels.panel.brand} ${solarPanels.panel.model} (${solarPanels.added_power_kwp} kWp novos, ${solarPanels.array_power_kwp} kWp total)`;
        }
        if (solarPanels.existing) {
            return `Painéis existentes (${solarPanels.array_power_kwp} kWp)`;
        }
        return `${solarPanels.quantity} x ${solarPanels.panel.brand} ${solarPanels.panel.model} (${solarPanels.array_power_kwp} kWp)`;
    };

    const getExistingBatteryDescription = (existingBattery: any) => {
        if (!existingBattery?.has_battery) return '';
        const name = [existingBattery.brand, existingBattery.model].filter(Boolean).join(' ');
        const power = existingBattery.max_power_kw ? `, ${existingBattery.max_power_kw} kW` : '';
        return `${name ? `${name} - ` : ''}${existingBattery.capacity_kwh} kWh${power}`;
    };

    const downloadProposalsPdf = async () => {
        if (!results?.recommendations?.length) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const maxWidth = pageWidth - margin * 2;
        let y = 0;

        // Brand Colors
        const orange = [234, 88, 12]; // #ea580c
        const black = [0, 0, 0];
        const grayText = [75, 85, 99]; // gray-600
        const lightGray = [249, 250, 251]; // gray-50
        const borderGray = [229, 231, 235]; // gray-200

        const roundedRect = (x: number, y: number, w: number, h: number, r: number, style: string) => {
            doc.roundedRect(x, y, w, h, r, r, style);
        };

        const addPageIfNeeded = (height = 20) => {
            if (y + height <= pageHeight - margin) return;
            doc.addPage();
            y = margin;
        };

        // --- PAGE 1: DATA PAGE ---
        const drawDataPage = () => {
            y = 30;
            doc.setTextColor(...black);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.text('Otimizador de produção e consumo residencial', margin, y);

            y += 15;
            doc.setFontSize(12);
            doc.setTextColor(...orange);
            const locationParts = [formData.solar.location, formData.solar.city, formData.solar.country].filter(Boolean);
            const location = locationParts.join(', ') || 'Desconhecido';
            const grid = formData.solar.grid_type === 'single_phase' ? 'MONOFÁSICA' : formData.solar.grid_type === 'three_phase' ? 'TRIFÁSICA' : 'NÃO INDICADA';
            doc.text(`LOCALIZAÇÃO: ${location.toUpperCase()} | REDE: ${grid}`, margin, y);

            y += 15;
            doc.setTextColor(...black);
            doc.setFontSize(14);
            doc.text('Parâmetros de Entrada:', margin, y);
            y += 10;

            const boxW = (maxWidth - 10) / 2;
            const drawParamBox = (x: number, currentY: number, label: string, val: string) => {
                doc.setFillColor(...lightGray);
                roundedRect(x, currentY, boxW, 20, 3, 'F');
                doc.setTextColor(...grayText);
                doc.setFontSize(8);
                doc.text(label.toUpperCase(), x + 5, currentY + 7);
                doc.setTextColor(...black);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(val, x + 5, currentY + 15);
            };

            drawParamBox(margin, y, 'Consumo Anual Estimado', `${Math.round(results.summary?.annual_consumption_estimated ?? 0).toLocaleString()} kWh`);
            drawParamBox(margin + boxW + 10, y, 'Potência Solar Atual', `${formData.solar.peak_kw} kWp`);

            y += 25;
            drawParamBox(margin, y, 'Área da Habitação', `${formData.house.area_m2} m²`);
            drawParamBox(margin + boxW + 10, y, 'Ocupantes', `${formData.house.occupants} pessoas`);

            y += 35;
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Considerações Técnicas:', margin, y);
            y += 8;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...grayText);

            (results.notes || []).forEach((note: string) => {
                const lines = doc.splitTextToSize(`• ${note}`, maxWidth);
                if (y + lines.length * 5 > pageHeight - margin) return; // Simple check for this page
                doc.text(lines, margin, y);
                y += lines.length * 5 + 2;
            });
        };

        drawDataPage();

        // --- RECOMMENDATION PAGES (One per tier) ---
        budgetSections.forEach((section) => {
            const items = (results.recommendations || []).filter((rec: any) => rec.budget_tier === section.tier);
            if (!items.length) return;

            doc.addPage();
            y = 20;

            // Tier Page Header
            doc.setFillColor(...orange);
            roundedRect(margin, y, 50, 10, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(section.title.toUpperCase(), margin + 5, y + 7);

            y += 18;
            doc.setTextColor(...black);
            doc.setFontSize(10);
            const descLines = doc.splitTextToSize(section.description, maxWidth);
            doc.text(descLines, margin, y);
            y += (descLines.length * 5) + 8;

            items.forEach((rec: any, index: number) => {
                // Calculate dynamic height for equipment cards
                const equipW = (maxWidth - 30) / 3;
                const batteryLines = doc.splitTextToSize(getBatteryDescription(rec), equipW - 8);
                const inverterLines = rec.inverter ? doc.splitTextToSize(`${rec.inverter.brand} ${rec.inverter.model}`, equipW - 8) : [];
                const solarLines = doc.splitTextToSize(getSolarDescription(rec.solar_panels), equipW - 8);

                const maxEquipLines = Math.max(batteryLines.length, inverterLines.length, solarLines.length);
                const equipCardHeight = 10 + (maxEquipLines * 3.5);
                const solutionCardHeight = 42 + equipCardHeight;

                addPageIfNeeded(solutionCardHeight + 5);

                // Solution Container - Gray Background
                doc.setFillColor(...lightGray); // Light gray background
                roundedRect(margin, y, maxWidth, solutionCardHeight, 4, 'F');

                // Header Bar
                doc.setFillColor(230, 230, 235);
                roundedRect(margin + 0.1, y + 0.1, maxWidth - 0.2, 8, 4, 'F');
                doc.setTextColor(...black);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(`Solução ${index + 1}`, margin + 6, y + 5.5);

                let contentY = y + 14;

                // --- FINANCIAL METRICS ---
                const metW = maxWidth / 3;

                const drawFinancial = (x: number, label: string, val: string) => {
                    doc.setTextColor(...grayText);
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'bold');
                    doc.text(label.toUpperCase(), x, contentY);
                    doc.setTextColor(...orange);
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.text(val, x, contentY + 6);
                };

                drawFinancial(margin + 8, 'Investimento', formatPrice(rec.capex_total_eur));
                drawFinancial(margin + metW + 2, 'Poupança Anual', formatPrice(rec.savings_annual_eur));
                drawFinancial(margin + metW * 2 + 2, 'Retorno', rec.payback_years ? `${rec.payback_years} Anos` : 'N/A');

                contentY += 10;
                doc.setDrawColor(...borderGray);
                doc.line(margin + 8, contentY, margin + maxWidth - 8, contentY);
                contentY += 6;

                // --- EQUIPMENT CARDS ---
                doc.setTextColor(...black);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.text('EQUIPAMENTO INCLUÍDO:', margin + 8, contentY);
                contentY += 3;

                const drawEquipCard = (x: number, title: string, descLines: string[]) => {
                    doc.setFillColor(255, 255, 255); // White background for inner cards for contrast
                    roundedRect(x, contentY, equipW, equipCardHeight, 2, 'F');
                    doc.setTextColor(...orange);
                    doc.setFontSize(6);
                    doc.setFont('helvetica', 'bold');
                    doc.text(title.toUpperCase(), x + 3, contentY + 4);
                    doc.setTextColor(...black);
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'normal');
                    doc.text(descLines, x + 3, contentY + 7);
                };

                drawEquipCard(margin + 8, 'Bateria', batteryLines);
                if (rec.inverter) {
                    drawEquipCard(margin + equipW + 13, 'Inversor', inverterLines);
                    drawEquipCard(margin + equipW * 2 + 18, 'Painéis', solarLines);
                } else {
                    drawEquipCard(margin + equipW + 13, 'Painéis', solarLines);
                }

                y += solutionCardHeight + 5;
            });
        });

        // --- GLOBAL WATERMARK & PAGE NUMBERS ---
        const totalPages = doc.internal.getNumberOfPages();

        // Assemble final PDF first to know the total page count
        try {
            const pdfBytes = doc.output('arraybuffer');
            const mainPdfDoc = await PDFDocument.load(pdfBytes);

            const coverResponse = await fetch(coverPdfAsset);
            const coverBytes = await coverResponse.arrayBuffer();
            const coverPdfDoc = await PDFDocument.load(coverBytes);
            const coverPageCount = coverPdfDoc.getPageCount();
            const totalFinalPages = coverPageCount + totalPages;

            // Apply page numbers and watermark to the main doc before final assembly
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);

                doc.saveGraphicsState();
                doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
                doc.setFont("helvetica", "bold");
                doc.setFontSize(100);
                doc.setTextColor(150, 150, 150);
                const centerX = pageWidth / 2;
                const centerY = pageHeight / 2;
                doc.text("Watt Builder", centerX + 50, centerY + 70, { align: "center", angle: 45 });
                doc.restoreGraphicsState();

                // Page Number
                doc.setFontSize(8);
                doc.setTextColor(...grayText);
                doc.text(`Estudo de Independência Energética - Página ${i + coverPageCount} de ${totalFinalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }

            // Re-generate main PDF bytes after adding page numbers
            const mainPdfBytesWithNumbers = doc.output('arraybuffer');
            const mainPdfDocWithNumbers = await PDFDocument.load(mainPdfBytesWithNumbers);

            const finalPdfDoc = await PDFDocument.create();

            // Add cover pages
            const coverPages = await finalPdfDoc.copyPages(coverPdfDoc, coverPdfDoc.getPageIndices());
            coverPages.forEach(page => finalPdfDoc.addPage(page));

            // Add content pages
            const contentPages = await finalPdfDoc.copyPages(mainPdfDocWithNumbers, mainPdfDocWithNumbers.getPageIndices());
            contentPages.forEach(page => finalPdfDoc.addPage(page));

            const finalPdfBytes = await finalPdfDoc.save();
            const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Estudo-WattBuilder-${formData.solar.city || 'Portugal'}-${new Date().toISOString().slice(0, 10)}.pdf`;
            link.click();
        } catch (error) {
            console.error('Error assembling PDF with cover:', error);
            // Fallback to saving without custom cover if something fails
            doc.save(`Estudo-WattBuilder-${formData.solar.city || 'Portugal'}-${new Date().toISOString().slice(0, 10)}.pdf`);
        }
    };
    const activeTariffPeriods = getTariffPeriods(formData.tariff.type);
    const estimatedHouseTariffPrices = getHouseTariffPrices(formData.tariff.type, formData.house);

    return (
        <div className="flex flex-col min-h-screen bg-white text-black">
            <Navigation />

            <main className="flex-grow py-12">
                <div className="max-w-5xl mx-auto px-4">

                    {/* Progress Header */}
                    <div className="text-center mb-10 mt-20">
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
                                <button
                                    type="button"
                                    onClick={() => handleStepperClick(i)}
                                    disabled={!canOpenStep(i)}
                                    aria-label={`Ir para o passo ${i}`}
                                    className={`flex items-center justify-center w-10 h-10 rounded-full font-bold transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${step >= i ? 'bg-orange-600 text-white' : 'bg-white text-gray-300 border-2 border-gray-200'} ${canOpenStep(i) ? 'cursor-pointer hover:scale-105 hover:shadow-md' : 'cursor-not-allowed opacity-50'}`}
                                >
                                    {step > i ? <CheckCircle2 className="w-6 h-6" /> : i}
                                </button>
                                {i < 3 && <div className={`w-12 h-1 ${step > i ? 'bg-orange-600' : 'bg-gray-200'}`} />}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Step 1: Selection */}
                    {step === 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
                            <Card
                                onClick={() => goToStep(2, 'house')}
                                className={`cursor-pointer border-2 transition-all hover:shadow-lg ${mode === 'house' ? 'border-orange-600 bg-orange-50/50' : 'border-gray-200 hover:border-black'}`}
                            >
                                <CardContent className="p-8 text-center">
                                    <div className="bg-orange-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Home className="text-white w-8 h-8" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Pelas características da casa</h3>
                                    <p className="text-gray-500 text-sm">Quero estimar pelo número de pessoas e características da casa, com fatura opcional.</p>
                                </CardContent>
                            </Card>

                            <Card
                                onClick={() => goToStep(2, 'bill')}
                                className={`cursor-pointer border-2 transition-all hover:shadow-lg ${mode === 'bill' ? 'border-orange-600 bg-orange-50/50' : 'border-gray-200 hover:border-black'}`}
                            >
                                <CardContent className="p-8 text-center">
                                    <div className="bg-orange-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <FileText className="text-white w-8 h-8" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Pelo valor da fatura</h3>
                                    <p className="text-gray-500 text-sm">Tenho consumos mensais em kWh e quero usar histórico por tarifário.</p>
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
                        <Card className="shadow-xl border-gray-200 animate-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
                            <CardHeader>
                                <CardTitle>Configuração de Consumo</CardTitle>
                                <CardDescription className="text-gray-500">Ajuste os valores para uma simulação precisa.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label>Nº de pessoas na habitação</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            className="border-gray-300 focus-visible:ring-orange-600"
                                            value={formData.house.occupants}
                                            onChange={(e) => handleNumericChange(e.target.value, 'Nº de pessoas', (val) => setFormData({ ...formData, house: { ...formData.house, occupants: val } }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Área aproximada (m²)</Label>
                                        <Input
                                            type="number"
                                            min="10"
                                            className="border-gray-300 focus-visible:ring-orange-600"
                                            value={formData.house.area_m2}
                                            onChange={(e) => handleNumericChange(e.target.value, 'Área aproximada', (val) => setFormData({ ...formData, house: { ...formData.house, area_m2: val } }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Nº de pisos</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            className="border-gray-300 focus-visible:ring-orange-600"
                                            value={formData.house.floors}
                                            onChange={(e) => handleNumericChange(e.target.value, 'Nº de pisos', (val) => setFormData({ ...formData, house: { ...formData.house, floors: val } }))}
                                        />
                                    </div>
                                </div>

                                {mode === 'house' ? (
                                    <>
                                        <div className="pt-4 border-t border-gray-200">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                                <div>
                                                    <Label className="mb-1">Pretende inserir os dados da última fatura?</Label>
                                                    <p className="text-sm text-gray-500">Usamos esses dados apenas para estimar o preço por kWh.</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 sm:w-auto">
                                                    <Button
                                                        className={`h-12 ${formData.house.use_last_bill ? 'bg-white border border-gray-200 text-black hover:bg-gray-100' : 'bg-orange-600 text-white hover:bg-orange-700'}`}
                                                        onClick={() => setFormData({ ...formData, house: { ...formData.house, use_last_bill: false } })}
                                                    >
                                                        Não
                                                    </Button>
                                                    <Button
                                                        className={`h-12 ${formData.house.use_last_bill ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border border-gray-200 text-black hover:bg-gray-100'}`}
                                                        onClick={() => setFormData({ ...formData, house: { ...formData.house, use_last_bill: true } })}
                                                    >
                                                        Sim
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
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


                                {mode === 'house' && (formData.house.use_last_bill || isAdminMode) ? (
                                    <div className="pt-4 border-t border-gray-200 space-y-4">
                                                {formData.house.use_last_bill && (
                                            <div className="grid gap-4 md:grid-cols-4">
                                                {activeTariffPeriods.map((period) => (
                                                    <div key={period.key} className="space-y-2">
                                                        <Label>{period.label} (kWh)</Label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            className="border-gray-300 focus-visible:ring-orange-600"
                                                            value={formData.house.last_bill.consumption[period.key] ?? ''}
                                                            onChange={(e) => handleNumericChange(e.target.value, period.label, (val) => setFormData({
                                                                ...formData,
                                                                house: {
                                                                    ...formData.house,
                                                                    last_bill: {
                                                                        ...formData.house.last_bill,
                                                                        consumption: {
                                                                            ...formData.house.last_bill.consumption,
                                                                            [period.key]: val,
                                                                        },
                                                                    },
                                                                },
                                                            }))}
                                                        />
                                                    </div>
                                                ))}
                                                <div className="space-y-2">
                                                    <Label>Valor total da fatura</Label>
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            className="border-gray-300 focus-visible:ring-orange-600 pr-8"
                                                            value={formData.house.last_bill.total}
                                                            onChange={(e) => handleNumericChange(e.target.value, 'Valor total da fatura', (val) => setFormData({
                                                                ...formData,
                                                                house: {
                                                                    ...formData.house,
                                                                    last_bill: {
                                                                        ...formData.house.last_bill,
                                                                        total: val,
                                                                    },
                                                                },
                                                            }))}
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {isAdminMode && (
                                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                                <div className="mb-3 flex items-center justify-between gap-3">
                                                    <p className="text-sm font-semibold">
                                                        {formData.house.use_last_bill ? 'Preço estimado' : 'Preços padrão'}
                                                    </p>
                                                    <Badge variant="outline" className="border-gray-300 text-gray-600">
                                                        {formData.tariff.type === 'simple' ? 'Simples' : formData.tariff.type === 'bi' ? 'Bi-horário' : 'Tri-horário'}
                                                    </Badge>
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-3">
                                                    {activeTariffPeriods.map((period) => (
                                                        <div key={period.key} className="rounded-md bg-white border border-gray-200 px-3 py-2">
                                                            <p className="text-xs uppercase tracking-widest text-gray-400">{period.label}</p>
                                                            <p className="mt-1 font-semibold text-gray-900">
                                                                {formatTariffPrice(estimatedHouseTariffPrices[period.key])}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : null}

                                <div className="pt-4 border-t border-gray-200 space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div>
                                            <Label className="mb-1 text-base font-bold">Localização e Rede Elétrica</Label>
                                            <p className="text-sm text-gray-500">Ajude-nos a identificar o perfil solar e compatibilidade da rede.</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                                        <div className="space-y-2">
                                            <Label>Localidade</Label>
                                            <Input
                                                type="text"
                                                className="border-gray-300 focus-visible:ring-orange-600"
                                                value={formData.solar.location}
                                                onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, location: e.target.value } })}
                                                placeholder="Ex: Alfragide"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Tipo de Instalação Elétrica</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md">
                                            <Button
                                                className={`h-12 ${formData.solar.grid_type === 'single_phase' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border border-gray-200 text-black hover:bg-gray-100'}`}
                                                onClick={() => setFormData({ ...formData, solar: { ...formData.solar, grid_type: 'single_phase' } })}
                                            >
                                                Monofásica (1 fase)
                                            </Button>
                                            <Button
                                                className={`h-12 ${formData.solar.grid_type === 'three_phase' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border border-gray-200 text-black hover:bg-gray-100'}`}
                                                onClick={() => setFormData({ ...formData, solar: { ...formData.solar, grid_type: 'three_phase' } })}
                                            >
                                                Trifásica (3 fases)
                                            </Button>
                                        </div>
                                        {formData.solar.grid_type === 'single_phase' && (
                                            <p className="text-xs text-orange-600 font-medium">
                                                Apenas serão sugeridos inversores monofásicos compatíveis com a sua rede.
                                            </p>
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
                                                onClick={() => setFormData({
                                                    ...formData,
                                                    solar: {
                                                        ...formData.solar,
                                                        has_solar: false,
                                                        existing_inverter_brand: '',
                                                        existing_inverter_model: '',
                                                        existing_inverter_max_power_kw: 0,
                                                        has_battery: false,
                                                        battery_capacity_kwh: 0,
                                                        existing_battery_brand: '',
                                                        existing_battery_model: '',
                                                        existing_battery_max_power_kw: 0,
                                                    }
                                                })}
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
                                                <Label>Potência de pico existente (kWp)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                    value={formData.solar.peak_kw}
                                                    onChange={(e) => handleNumericChange(e.target.value, 'Potência de pico existente', (val) => setFormData({ ...formData, solar: { ...formData.solar, peak_kw: val } }))}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Potência máxima do inversor atual (kW)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                    value={formData.solar.existing_inverter_max_power_kw}
                                                    onChange={(e) => handleNumericChange(e.target.value, 'Potência máxima do inversor', (val) => setFormData({ ...formData, solar: { ...formData.solar, existing_inverter_max_power_kw: val } }))}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Marca do inversor atual</Label>
                                                <Input
                                                    type="text"
                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                    value={formData.solar.existing_inverter_brand}
                                                    onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, existing_inverter_brand: e.target.value } })}
                                                    placeholder="Ex: Huawei"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Modelo do inversor atual</Label>
                                                <Input
                                                    type="text"
                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                    value={formData.solar.existing_inverter_model}
                                                    onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, existing_inverter_model: e.target.value } })}
                                                    placeholder="Ex: SUN2000-5KTL"
                                                />
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <Label>Deseja adicionar mais painéis solares?</Label>
                                                <div className="grid grid-cols-2 gap-2 max-w-sm">
                                                    <Button
                                                        className={`h-12 ${formData.solar.expand_solar ? 'bg-white border border-gray-200 text-black hover:bg-gray-100' : 'bg-orange-600 text-white hover:bg-orange-700'}`}
                                                        onClick={() => setFormData({ ...formData, solar: { ...formData.solar, expand_solar: false } })}
                                                    >
                                                        Não
                                                    </Button>
                                                    <Button
                                                        className={`h-12 ${formData.solar.expand_solar ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border border-gray-200 text-black hover:bg-gray-100'}`}
                                                        onClick={() => setFormData({ ...formData, solar: { ...formData.solar, expand_solar: true } })}
                                                    >
                                                        Sim
                                                    </Button>
                                                </div>
                                                {!formData.solar.expand_solar && (
                                                    <p className="mt-2 text-sm text-gray-500">
                                                        As sugestões focar-se-ão apenas em baterias para o sistema existente.
                                                    </p>
                                                )}
                                            </div>

                                            <div className="space-y-2 md:col-span-2">
                                                <Label>Já tem bateria?</Label>
                                                <div className="grid grid-cols-2 gap-2 max-w-sm">
                                                    <Button
                                                        className={`h-12 ${formData.solar.has_battery ? 'bg-white border border-gray-200 text-black hover:bg-gray-100' : 'bg-orange-600 text-white hover:bg-orange-700'}`}
                                                        onClick={() => setFormData({ ...formData, solar: { ...formData.solar, has_battery: false, battery_capacity_kwh: 0, existing_battery_brand: '', existing_battery_model: '', existing_battery_max_power_kw: 0 } })}
                                                    >
                                                        Não
                                                    </Button>
                                                    <Button
                                                        className={`h-12 ${formData.solar.has_battery ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border border-gray-200 text-black hover:bg-gray-100'}`}
                                                        onClick={() => setFormData({ ...formData, solar: { ...formData.solar, has_battery: true, battery_capacity_kwh: formData.solar.battery_capacity_kwh || 5 } })}
                                                    >
                                                        Sim
                                                    </Button>
                                                </div>

                                                {formData.solar.has_battery && (
                                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Capacidade da bateria atual (kWh)</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.1"
                                                                className="border-gray-300 focus-visible:ring-orange-600"
                                                                value={formData.solar.battery_capacity_kwh}
                                                                onChange={(e) => handleNumericChange(e.target.value, 'Capacidade da bateria atual', (val) => setFormData({ ...formData, solar: { ...formData.solar, battery_capacity_kwh: val } }))}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Potência máxima da bateria atual (kW)</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.1"
                                                                className="border-gray-300 focus-visible:ring-orange-600"
                                                                value={formData.solar.existing_battery_max_power_kw}
                                                                onChange={(e) => handleNumericChange(e.target.value, 'Potência máxima da bateria atual', (val) => setFormData({ ...formData, solar: { ...formData.solar, existing_battery_max_power_kw: val } }))}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Marca da bateria atual</Label>
                                                            <Input
                                                                type="text"
                                                                className="border-gray-300 focus-visible:ring-orange-600"
                                                                value={formData.solar.existing_battery_brand}
                                                                onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, existing_battery_brand: e.target.value } })}
                                                                placeholder="Ex: Huawei"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Modelo do bateria atual</Label>
                                                            <Input
                                                                type="text"
                                                                className="border-gray-300 focus-visible:ring-orange-600"
                                                                value={formData.solar.existing_battery_model}
                                                                onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, existing_battery_model: e.target.value } })}
                                                                placeholder="Ex: Luna2000"
                                                            />
                                                        </div>
                                                        <p className="text-xs text-gray-500 md:col-span-2">
                                                            Estes dados serão considerados como equipamento já instalado no dimensionamento.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-gray-200 space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <Car className="w-5 h-5 mt-1 text-orange-600" />
                                            <div>
                                                <Label className="mb-1">Tem carro elétrico?</Label>
                                                <p className="text-sm text-gray-500">Adicionamos o consumo de carregamento à simulação energética.</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 sm:w-auto">
                                            <Button
                                                className={`h-12 ${formData.electric_vehicles.has_electric_vehicle ? 'bg-white border border-gray-200 text-black hover:bg-gray-100' : 'bg-orange-600 text-white hover:bg-orange-700'}`}
                                                onClick={() => updateElectricVehicleCount(0)}
                                            >
                                                Não
                                            </Button>
                                            <Button
                                                className={`h-12 ${formData.electric_vehicles.has_electric_vehicle ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border border-gray-200 text-black hover:bg-gray-100'}`}
                                                onClick={() => updateElectricVehicleCount(Math.max(1, formData.electric_vehicles.count || 1))}
                                            >
                                                Sim
                                            </Button>
                                        </div>
                                    </div>

                                    {formData.electric_vehicles.has_electric_vehicle && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <p className="text-sm font-semibold">Carros elétricos</p>
                                                    <p className="text-sm text-gray-500">{formData.electric_vehicles.vehicles.length} adicionados</p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    className="h-10 bg-black text-white hover:bg-gray-800"
                                                    onClick={addElectricVehicle}
                                                    disabled={formData.electric_vehicles.vehicles.length >= 6}
                                                >
                                                    <Plus className="w-4 h-4 mr-2" />
                                                    Adicionar carro
                                                </Button>
                                            </div>

                                            <div className="space-y-4">
                                                {formData.electric_vehicles.vehicles.map((vehicle: any, index: number) => (
                                                    <div key={index} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                                        <div className="mb-3 flex items-center justify-between gap-3">
                                                            <div className="font-semibold">Carro {index + 1}</div>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                className="h-9 border-gray-300 text-black hover:bg-gray-100"
                                                                onClick={() => removeElectricVehicle(index)}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                        <div className="grid gap-4 md:grid-cols-4">
                                                            <div className="space-y-2">
                                                                <Label>Km por dia</Label>
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                                    value={vehicle.daily_km}
                                                                    onChange={(e) => handleNumericChange(e.target.value, 'Km por dia', (val) => updateElectricVehicle(index, 'daily_km', val))}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Consumo (kWh/km)</Label>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                                    value={vehicle.consumption_kwh_per_km}
                                                                    onChange={(e) => handleNumericChange(e.target.value, 'Consumo (kWh/km)', (val) => updateElectricVehicle(index, 'consumption_kwh_per_km', val))}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Marca</Label>
                                                                <Input
                                                                    type="text"
                                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                                    value={vehicle.brand}
                                                                    onChange={(e) => updateElectricVehicle(index, 'brand', e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Modelo</Label>
                                                                <Input
                                                                    type="text"
                                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                                    value={vehicle.model}
                                                                    onChange={(e) => updateElectricVehicle(index, 'model', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 space-y-2">
                                                            <Label>Quando carrega normalmente?</Label>
                                                            <div className="grid gap-2 md:grid-cols-3">
                                                                {[
                                                                    { key: 'night', label: 'Só à noite' },
                                                                    { key: 'day', label: 'Durante o dia' },
                                                                    { key: 'mixed', label: 'Dia e noite' },
                                                                ].map((option) => (
                                                                    <Button
                                                                        key={option.key}
                                                                        className={`h-11 ${vehicle.charging_schedule === option.key ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border border-gray-200 text-black hover:bg-gray-100'}`}
                                                                        onClick={() => updateElectricVehicle(index, 'charging_schedule', option.key)}
                                                                    >
                                                                        {option.label}
                                                                    </Button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
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
                                                        const val = Number(e.target.value);
                                                        if (val < 0) {
                                                            toast({
                                                                title: 'Valor Inválido',
                                                                description: 'O número de meses não pode ser negativo.',
                                                                variant: 'destructive',
                                                            });
                                                            return;
                                                        }
                                                        const months = Math.min(12, Math.max(1, val || 1));
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
                                                        <div className={`grid gap-4 ${formData.tariff.type === 'tri' ? (formData.solar.has_solar ? 'md:grid-cols-5' : 'md:grid-cols-4') : formData.tariff.type === 'bi' ? (formData.solar.has_solar ? 'md:grid-cols-4' : 'md:grid-cols-3') : (formData.solar.has_solar ? 'md:grid-cols-3' : 'md:grid-cols-2')}`}>
                                                        {formData.tariff.type === 'simple' && (
                                                            <div className="space-y-2">
                                                                <Label>Consumo (kWh)</Label>
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                                    value={entry.simple ?? ''}
                                                                    onChange={(e) => handleNumericChange(e.target.value, 'Consumo', (val) => {
                                                                        const history = [...formData.bill.history];
                                                                        history[index] = { ...history[index], simple: val };
                                                                        setFormData({ ...formData, bill: { ...formData.bill, history } });
                                                                    })}
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
                                                                        onChange={(e) => handleNumericChange(e.target.value, 'Vazio', (val) => {
                                                                            const history = [...formData.bill.history];
                                                                            history[index] = { ...history[index], offPeak: val };
                                                                            setFormData({ ...formData, bill: { ...formData.bill, history } });
                                                                        })}
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>Cheia (kWh)</Label>
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        className="border-gray-300 focus-visible:ring-orange-600"
                                                                        value={entry.peak ?? ''}
                                                                        onChange={(e) => handleNumericChange(e.target.value, 'Cheia', (val) => {
                                                                            const history = [...formData.bill.history];
                                                                            history[index] = { ...history[index], peak: val };
                                                                            setFormData({ ...formData, bill: { ...formData.bill, history } });
                                                                        })}
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
                                                                            onChange={(e) => handleNumericChange(e.target.value, 'Ponta', (val) => {
                                                                                const history = [...formData.bill.history];
                                                                                history[index] = { ...history[index], ponta: val };
                                                                                setFormData({ ...formData, bill: { ...formData.bill, history } });
                                                                            })}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                        <div className="space-y-2">
                                                            <Label>Valor da fatura</Label>
                                                            <div className="relative">
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    className="border-gray-300 focus-visible:ring-orange-600 pr-8"
                                                                    value={entry.bill_total ?? ''}
                                                                    onChange={(e) => handleNumericChange(e.target.value, 'Valor da fatura', (val) => {
                                                                        const history = [...formData.bill.history];
                                                                        history[index] = { ...history[index], bill_total: val };
                                                                        setFormData({ ...formData, bill: { ...formData.bill, history } });
                                                                    })}
                                                                />
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                                                            </div>
                                                        </div>
                                                        {formData.solar.has_solar && (
                                                            <div className="space-y-2">
                                                                <Label>Produção solar (kWh)</Label>
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    className="border-gray-300 focus-visible:ring-orange-600"
                                                                    value={entry.production ?? ''}
                                                                    onChange={(e) => handleNumericChange(e.target.value, 'Produção solar', (val) => {
                                                                        const history = [...formData.bill.history];
                                                                        history[index] = { ...history[index], production: val };
                                                                        setFormData({ ...formData, bill: { ...formData.bill, history } });
                                                                    })}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isAdminMode && (
                                                        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
                                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                                <p className="text-sm font-semibold">Estimativa deste mês</p>
                                                                <Badge variant="outline" className="border-gray-300 text-gray-600">
                                                                    {formData.tariff.type === 'simple' ? 'Simples' : formData.tariff.type === 'bi' ? 'Bi-horário' : 'Tri-horário'}
                                                                </Badge>
                                                            </div>
                                                            <div className="grid gap-3 sm:grid-cols-3">
                                                                {activeTariffPeriods.map((period) => {
                                                                    const monthPrices = getBillMonthTariffPrices(formData.tariff.type, entry);
                                                                    return (
                                                                        <div key={period.key} className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
                                                                            <p className="text-xs uppercase tracking-widest text-gray-400">{period.label}</p>
                                                                            <p className="mt-1 font-semibold text-gray-900">
                                                                                {formatTariffPrice(monthPrices[period.key])}
                                                                            </p>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 border-t border-gray-200">
                                    <Label>Qual o valor máximo de investimento que pretende? (Opcional)</Label>
                                    <div className="mt-2 relative max-w-sm">
                                        <Input
                                            type="number"
                                            min="0"
                                            placeholder="Ex: 5000"
                                            className="border-gray-300 focus-visible:ring-orange-600 pr-8"
                                            value={formData.max_investment}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val !== '' && Number(val) < 0) {
                                                    toast({
                                                        title: 'Valor Inválido',
                                                        description: 'O valor para "Investimento Máximo" não pode ser negativo.',
                                                        variant: 'destructive',
                                                    });
                                                    return;
                                                }
                                                setFormData({ ...formData, max_investment: val });
                                            }}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">Se deixar em branco, mostraremos todas as opções disponíveis.</p>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <Button variant="outline" className="border-gray-300 text-black hover:bg-gray-100" onClick={() => goToStep(1, null)}>
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
                        <div className="space-y-8 animate-in zoom-in-95 duration-500 max-w-5xl mx-auto">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold">Propostas recomendadas</h2>
                                    <p className="text-sm text-gray-500">Abaixo as opções otimizadas para as tuas necessidades de consumo.</p>
                                </div>
                                <Button onClick={downloadProposalsPdf} className="bg-black text-white hover:bg-gray-800" disabled={!results?.recommendations?.length}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Descarregar PDF
                                </Button>
                            </div>

                            {results?.recommendations?.length === 0 && (
                                <div className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-r-xl">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl animate-bounce">😟</span>
                                        <h3 className="text-lg font-bold text-orange-900">Nenhuma solução encontrada</h3>
                                    </div>
                                    <p className="mt-2 text-orange-800">
                                        Com os parâmetros atuais, não conseguimos encontrar um sistema de baterias que cumpra os requisitos técnicos e económicos.
                                        Experimente ajustar o seu consumo, orçamento ou potência solar e tente novamente.
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="mt-4 border-orange-500 text-orange-900 hover:bg-orange-100"
                                        onClick={() => goToStep(2)}
                                    >
                                        Ajustar Parâmetros
                                    </Button>
                                </div>
                            )}

                            <div className="space-y-10">
                                {recommendationGroups.map((group) => (
                                    group.items.length > 0 && (
                                        <section key={group.tier} className="space-y-4">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-gray-200 pb-2">
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <h2 className="text-xl font-extrabold tracking-tight">{group.title}</h2>
                                                        <Badge variant="outline" className={group.badgeClass}>
                                                            {group.items.length} opções
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-gray-500">{group.description}</p>
                                                </div>
                                            </div>

                                            {/* Grelha Compacta para as soluções */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {group.items.map((rec: any, idx: number) => {
                                                    return (
                                                        <Card
                                                            key={`${group.tier}-${rec.system_name || rec.battery?.id || idx}`}
                                                            onClick={() => setSelectedRecommendation(rec)}
                                                            className="cursor-pointer relative overflow-hidden transition-all hover:scale-[1.02] bg-white flex flex-col h-full border-gray-200 shadow-sm"
                                                        >
                                                            <CardHeader className="p-4 pb-2">
                                                                <CardTitle className="text-lg leading-tight">Solução {idx + 1}</CardTitle>
                                                                <CardDescription className="text-xs mt-1 line-clamp-2">
                                                                    {getBatteryDescription(rec)}
                                                                    {rec.inverter && ` • Inv. ${rec.inverter.brand}`}
                                                                    {rec.solar_panels && ` • ${rec.solar_panels.quantity} Painéis`}
                                                                </CardDescription>
                                                            </CardHeader>

                                                            <CardContent className="p-4 pt-2 flex-grow flex flex-col gap-4">
                                                                <div className="flex items-baseline gap-1 border-b border-gray-100 pb-3">
                                                                    <span className="text-2xl font-extrabold">{formatPrice(rec.capex_total_eur)}</span>
                                                                    <span className="text-gray-400 text-xs">est.</span>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-2 text-sm border border-gray-100">
                                                                    <div>
                                                                        <p className="text-xs text-gray-500">Poupança</p>
                                                                        <p className="font-bold text-orange-600">{formatPrice(rec.savings_annual_eur)}/ano</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-gray-500">Retorno</p>
                                                                        <p className="font-bold">{rec.payback_years ? `${rec.payback_years} anos` : 'N/A'}</p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-col gap-2 mt-auto">
                                                                    <Button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRequestQuote(rec);
                                                                        }}
                                                                        className="w-full bg-white border border-gray-300 text-black hover:bg-gray-50"
                                                                        size="sm"
                                                                    >
                                                                        Solicitar Orçamento
                                                                    </Button>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    )
                                ))}
                            </div>

                            {/* Modal de Detalhes Refatorado */}
                            {selectedRecommendation && (
                                <RecommendationModal
                                    recommendation={selectedRecommendation}
                                    onClose={() => setSelectedRecommendation(null)}
                                    onRequestQuote={handleRequestQuote}
                                    formatPrice={formatPrice}
                                    getSystemName={getSystemName}
                                    getExistingBatteryDescription={getExistingBatteryDescription}
                                    getPriceBreakdown={getPriceBreakdown}
                                />
                            )}

                            {/* Secção de Avaliação */}
                            <div className="bg-white p-8 rounded-2xl border-2 border-orange-100 shadow-sm text-center space-y-6">
                                {!hasRated ? (
                                    <>
                                        <div>
                                            <h3 className="text-xl font-bold mb-2">O que achou destas soluções?</h3>
                                            <p className="text-gray-500">A sua avaliação ajuda-nos a melhorar o nosso algoritmo.</p>
                                        </div>

                                        <div className="flex flex-wrap justify-center gap-2">
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onClick={() => {
                                                        setUserRating(star);
                                                        handleRatingSubmit(star, undefined, false);
                                                    }}
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${userRating === star ? 'bg-orange-600 text-white' : 'bg-gray-50 text-gray-400 hover:bg-orange-100 hover:text-orange-600'}`}
                                                >
                                                    <span className="font-bold text-sm">{star}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {userRating !== null && userRating <= 8 && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4 pt-4 max-w-lg mx-auto border-t border-gray-100">
                                                <div className="text-left">
                                                    <Label className="text-sm font-semibold">Como podemos melhorar? (Opcional)</Label>
                                                    <Textarea
                                                        value={ratingComment}
                                                        onChange={(e) => setRatingComment(e.target.value)}
                                                        placeholder="Diga-nos o que faltou ou o que poderia ser melhor..."
                                                        className="mt-2 bg-white border-gray-200"
                                                        rows={3}
                                                    />
                                                </div>
                                                <Button
                                                    onClick={() => handleRatingSubmit(userRating, ratingComment, true)}
                                                    disabled={isSendingRating}
                                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                                                >
                                                    {isSendingRating ? <Loader2 className="animate-spin w-4 h-4" /> : 'Submeter Comentário'}
                                                </Button>
                                            </div>
                                        )}

                                        {userRating !== null && userRating > 8 && (
                                            <div className="animate-in fade-in duration-300 pt-2">
                                                <p className="text-emerald-600 font-medium">Obrigado pela sua avaliação!</p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="py-4 animate-in zoom-in duration-500">
                                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <CheckCircle2 className="w-8 h-8" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">Obrigado pelo seu feedback!</h3>
                                        <p className="text-gray-500">A sua opinião é fundamental para continuarmos a evoluir.</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-sm text-gray-500">
                                <h4 className="font-bold text-black mb-2">Notas da Simulação:</h4>
                                <ul className="list-disc ml-4 space-y-1">
                                    {(results.notes || []).map((note: string, index: number) => (
                                        <li key={index}>{note}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="text-center">
                                <Button variant="link" onClick={() => goToStep(1, null)} className="text-gray-500 hover:text-black">Refazer Simulação</Button>
                            </div>
                        </div>
                    )}

                    {/* Waiting List Section */}
                    <section className="mt-24 p-10 bg-orange-50 rounded-3xl text-black relative overflow-hidden max-w-5xl mx-auto">
                        <div className="relative z-10 max-w-xl">
                            <h2 className="text-2xl font-bold mb-4">Deseja um Relatório Técnico Completo?</h2>
                            <p className="text-gray-700 mb-6">A nossa equipa realiza um estudo detalhado e perfil de carga específico para a sua empresa ou habitação.</p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Input value={reportEmail} onChange={(e) => setReportEmail(e.target.value)} placeholder="Email" className="bg-white border-gray-200 text-black placeholder:text-gray-400 focus-visible:ring-orange-600" />
                                <Button onClick={handleSendReportEmail} disabled={isSendingReportEmail} className="bg-orange-600 hover:bg-orange-700 px-8 text-white">
                                    {isSendingReportEmail ? <Loader2 className="animate-spin w-4 h-4" /> : 'Receber Informação'}
                                </Button>
                            </div>

                            <div className="mt-8 border-t border-orange-200 pt-6">
                                <h3 className="text-lg font-bold mb-2">Ajude-nos a melhorar</h3>
                                <p className="text-gray-700 mb-4">Partilhe feedback sobre a simulação, resultados ou experiência de utilização.</p>
                                <Textarea
                                    value={feedbackMessage}
                                    onChange={(e) => setFeedbackMessage(e.target.value)}
                                    placeholder="Escreva aqui o seu feedback"
                                    rows={4}
                                    className="bg-white border-gray-200 text-black placeholder:text-gray-400 focus-visible:ring-orange-600"
                                />
                                <div className="mt-3 flex justify-end">
                                    <Button onClick={handleSendFeedback} disabled={isSendingFeedback} className="bg-black hover:bg-gray-800 text-white">
                                        {isSendingFeedback ? <Loader2 className="animate-spin w-4 h-4" /> : 'Enviar Feedback'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <Battery className="absolute -right-10 -bottom-10 w-64 h-64 text-orange-200/20 rotate-12" />
                    </section>

                </div>
            </main >

            <Footer />
        </div >
    );
}
