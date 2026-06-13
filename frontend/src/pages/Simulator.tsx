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
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useAppMode } from '@/context/AppModeContext';
import { useToast } from '@/hooks/use-toast';
import RecommendationModal from '@/components/RecommendationModal';
import DebugSimulationChart from '@/components/DebugSimulationChart';
import { LocationCombobox } from '@/components/LocationCombobox';
import { SeoHead } from '@/components/SeoHead';
import { Stepper } from './simulator/components/Stepper';
import { ResultsSkeleton } from './simulator/components/ResultsSkeleton';
import { FriendlyNumericInput } from './simulator/components/FriendlyNumericInput';
import { StepModeSelection } from './simulator/components/StepModeSelection';
import { StepHouseData } from './simulator/components/StepHouseData';
import { StepConsumptionData } from './simulator/components/StepConsumptionData';
import { StepSolarData } from './simulator/components/StepSolarData';
// @ts-ignore
import coverPdfAsset from '@/assets/Watt Builder_Cover.pdf';
import {
    Battery, Home, FileText, Zap, Sun, Car,
    ChevronRight, ChevronLeft, Loader2,
    CheckCircle2, TrendingUp, Wallet, Plus, Trash2, Star,
    LineChart as LucideLineChart, LayoutGrid, Info, ArrowRight, Sparkles, Lightbulb,
    Download
} from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChartTooltip } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';

const RoofMapPicker = React.lazy(() => import('@/components/RoofMapPicker'));

type InputMode = 'house' | 'bill' | 'eredes';
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

const FEEDBACK_FORM_QUESTIONS = [
    {
        id: 'q1',
        question: '1. Onde sente que os nossos resultados poderiam estar mais próximos da sua realidade?',
        options: [
            'O meu perfil de consumo de energia (não refletia exatamente a minha casa).',
            'O tamanho do sistema (quantidade de painéis ou capacidade da bateria).',
            'Os equipamentos sugeridos (os preços ou as marcas apresentadas).',
            'As estimativas financeiras (poupança anual e tempo de retorno).',
            'A apresentação visual ou a clareza da informação no relatório.'
        ]
    },
    {
        id: 'q2',
        question: '2. Em relação aos equipamentos (Painéis e Baterias) que sugerimos, qual a sua perspetiva?',
        options: [
            'Os preços pareceram-me acima dos valores praticados no mercado.',
            'Os preços pareceram-me abaixo do esperado.',
            'O sistema sugerido pareceu-me sobre dimensionado para o que preciso.',
            'O sistema sugerido pareceu-me subdimensionado.',
            'Senti a falta de algumas marcas da minha preferência.',
            'Faltou-me informação técnica para compreender as escolhas do algoritmo.',
            'Os equipamentos pareceram-me bem, o ponto a melhorar é outro.'
        ]
    },
    {
        id: 'q3',
        question: '3. Sobre a estimativa de poupança e investimento financeiro, o que o deixou com mais dúvidas?',
        options: [
            'A estimativa de poupança anual pareceu-me demasiado otimista.',
            'O tempo para recuperar o investimento (Payback) pareceu-me demasiado curto.',
            'O investimento inicial sugerido difere de orçamentos reais que já obtive.',
            'Tive dificuldade em compreender como chegaram a estes cálculos financeiros.',
            'Gostaria de ver outros custos espelhados (ex: manutenção, seguros, taxas).'
        ]
    },
    {
        id: 'q4',
        question: '4. Durante a sua navegação na Watt Builder, o que sentiu que faltava para ser uma experiência 10/10?',
        options: [
            'Um formulário inicial mais rápido e simples.',
            'Um formulário mais detalhado (mais opções para descrever bem os meus consumos).',
            'Mais explicações fáceis sobre conceitos técnicos (ex: o que é um inversor híbrido).',
            'A possibilidade de eu mesmo ajustar manualmente a quantidade de painéis/baterias no fim.',
            'O site estava um pouco lento ou surgiu algum erro técnico.'
        ]
    }
];

const formatTariffPrice = (value: number) => `${Number(value || 0).toFixed(3)} €/kWh`;

const parseStepParam = (value: string | null) => {
    if (value === 'house') return 2;
    if (value === 'solar') return 3;
    if (value === 'consumption') return 4;
    if (value === 'results') return 5;
    // Compatibility with old or default mappings
    if (value === 'input') return 2;
    return 1;
};

const parseModeParam = (value: string | null): InputMode | null => {
    return value === 'house' || value === 'bill' || value === 'eredes' ? value : null;
};

const DEFAULT_STATE = {
    house: {
        occupants: 3,
        area_m2: 120,
        floors: 1,
        use_last_bill: false,
        last_bill: {
            total: 0,
            production: 0,
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
    eredes: {
        has_solar_before: false,
        csv_profile: null as any,
        file_name: '',
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
        expand_solar: true,
        roof_mapping: {
            enabled: false,
            address: '',
            center: null,
            polygon: null,
            area_m2: 0,
            provider: 'mapbox' as const,
        },
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
    const [isUploading, setIsUploading] = useState(false);
    const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
    const [isSubmittingPremium, setIsSubmittingPremium] = useState(false);
    const [mode, setMode] = useState<InputMode | null>(() => parseModeParam(searchParams.get('mode')));

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!isAuthenticated || !token) {
            toast({
                title: 'Autenticação necessária',
                description: 'Por favor, faça login para processar ficheiros E-Redes.',
                variant: 'destructive',
            });
            return;
        }

        setIsUploading(true);
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('has_solar', String(formData.solar.has_solar));

        try {
            const response = await fetch(getApiUrl('api/simulator/upload-csv'), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formDataUpload,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erro ao processar ficheiro');
            }

            const data = await response.json();
            setFormData({
                ...formData,
                eredes: {
                    ...formData.eredes,
                    csv_profile: data,
                    file_name: file.name
                }
            });

            toast({
                title: 'Ficheiro processado',
                description: `O ficheiro "${file.name}" foi processado com sucesso.`,
            });
        } catch (error: any) {
            console.error('Erro no upload:', error);
            toast({
                title: 'Erro no processamento',
                description: error.message || 'Verifique o formato do ficheiro E-Redes.',
                variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
        }
    };


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
    const [feedbackQuestions, setFeedbackQuestions] = useState<{ [key: string]: string[] }>({
        q1: [],
        q2: [],
        q3: [],
        q4: [],
    });
    const [xAxis, setXAxis] = useState('new_battery_capacity_kwh');
    const [yAxis, setYAxis] = useState('capex_total_eur');
    const [activeTab, setActiveTab] = useState('best');
    const [allSolutionsView, setAllSolutionsView] = useState<'chart' | 'table'>('chart');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'battery_only' | 'solar_only' | 'hybrid'>('all');

    const filteredRecommendations = React.useMemo(() => {
        const items = (results?.all_recommendations || []).filter((rec: any) => rec !== null && typeof rec === 'object');
        return items.filter(rec => {
            const isHybrid = rec.new_battery_added && rec.new_panels_added;
            const isSolarOnly = !rec.new_battery_added && rec.new_panels_added;
            const isBatteryOnly = rec.new_battery_added && !rec.new_panels_added;

            if (filterType === 'battery_only') return isBatteryOnly;
            if (filterType === 'solar_only') return isSolarOnly;
            if (filterType === 'hybrid') return isHybrid;
            return true;
        });
    }, [results?.all_recommendations, filterType]);

    const sortedRecommendations = React.useMemo(() => {
        const items = [...filteredRecommendations];
        if (sortConfig !== null) {
            items.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Handle nested battery/inverter/panel names for sorting if needed, 
                // but usually the numeric keys are what users want to sort by.
                if (aValue === undefined || aValue === null) return 1;
                if (bValue === undefined || bValue === null) return -1;

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return items;
    }, [filteredRecommendations, sortConfig]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

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
            const feedbackText = isFinal ? [
                '--- Respostas ao Formulário ---',
                `1. Onde sente que os nossos resultados poderiam estar mais próximos da sua realidade?`,
                `   R: ${feedbackQuestions.q1.join(', ') || 'Nenhuma selecionada'}`,
                `2. Em relação aos equipamentos (Painéis e Baterias) que sugerimos, qual a sua perspetiva?`,
                `   R: ${feedbackQuestions.q2.join(', ') || 'Nenhuma selecionada'}`,
                `3. Sobre a estimativa de poupança e investimento financeiro, o que o deixou com mais dúvidas?`,
                `   R: ${feedbackQuestions.q3.join(', ') || 'Nenhuma selecionada'}`,
                `4. Durante a sua navegação na Watt Builder, o que sentiu que faltava para ser uma experiência 10/10?`,
                `   R: ${feedbackQuestions.q4.join(', ') || 'Nenhuma selecionada'}`,
                ''
            ].join('\n') : '';

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
                        feedbackText,
                        comment ? `Comentário Adicional: ${comment}` : 'Sem comentário adicional.',
                        '',
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

    const handlePremiumInterest = async () => {
        if (!isAuthenticated || !token) {
            toast({
                title: 'Autenticação necessária',
                description: 'Por favor, faça login para aceder a esta funcionalidade.',
                variant: 'destructive',
            });
            return;
        }

        setIsSubmittingPremium(true);
        try {
            const response = await fetch(getApiUrl('api/premium-report-interest'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (response.ok) {
                setIsPremiumModalOpen(true);
            } else {
                toast({
                    title: "Erro",
                    description: "Não foi possível registar o seu interesse. Por favor tente mais tarde.",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error("Premium interest error:", error);
            toast({
                title: "Erro de Conexão",
                description: "Verifique a sua internet e tente novamente.",
                variant: "destructive"
            });
        } finally {
            setIsSubmittingPremium(false);
        }
    };

    const downloadDebugCSV = () => {
        if (!results?.debug_series) return;

        const { load, pv, soc } = results.debug_series;
        const rows = [['Hora', 'Consumo (kWh)', 'Producao Solar (kWh)', 'Estado Bateria (kWh)']];

        for (let i = 0; i < load.length; i++) {
            rows.push([
                i.toString(),
                load[i].toString().replace('.', ','),
                (pv[i] || 0).toString().replace('.', ','),
                (soc[i] || 0).toString().replace('.', ',')
            ]);
        }

        const csvContent = rows.map(e => e.join(";")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `debug_simulacao_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
        if (formData.solar.roof_mapping?.enabled) {
            lines.push(`Telhado no mapa: ${formData.solar.roof_mapping.polygon ? `Sim (${formData.solar.roof_mapping.area_m2} m2)` : 'Selecionado, sem polígono desenhado'}`);
        }

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
                solar: {
                    ...DEFAULT_STATE.solar,
                    ...(parsed.solar || {}),
                    roof_mapping: {
                        ...DEFAULT_STATE.solar.roof_mapping,
                        ...(parsed.solar?.roof_mapping || {}),
                    },
                },
                max_investment: parsed.max_investment ?? DEFAULT_STATE.max_investment,
                electric_vehicles: normalizeElectricVehicles(parsed.electric_vehicles || DEFAULT_STATE.electric_vehicles),
                eredes: parsed.eredes || DEFAULT_STATE.eredes
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
            const stepMap: Record<number, string> = {
                2: 'house',
                3: 'solar',
                4: 'consumption',
                5: 'results'
            };
            params.set('step', stepMap[nextStep] || 'input');
            if (nextMode) params.set('mode', nextMode);
            else params.delete('mode');
        }

        setSearchParams(params, { replace: options.replace ?? false });
    };

    const canOpenStep = (targetStep: number) => {
        if (targetStep === 1) return true;
        if (targetStep === 2) return Boolean(mode);
        if (targetStep === 3) return Boolean(mode);
        if (targetStep === 4) return Boolean(mode);
        return Boolean(results);
    };

    const handleStepperClick = (targetStep: number) => {
        if (targetStep >= step) return;
        goToStep(targetStep, mode);
    };

    useEffect(() => {
        const urlStep = parseStepParam(searchParams.get('step'));
        const urlMode = parseModeParam(searchParams.get('mode'));

        if (urlStep === 5 && !results) {
            goToStep(4, urlMode, { replace: true });
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
                if (entry.simple < 0) errors.push(`Mês ${i + 1}: Consumo`);
                if (entry.offPeak < 0) errors.push(`Mês ${i + 1}: Vazio`);
                if (entry.peak < 0) errors.push(`Mês ${i + 1}: Cheia`);
                if (entry.ponta < 0) errors.push(`Mês ${i + 1}: Ponta`);
                if (entry.bill_total < 0) errors.push(`Mês ${i + 1}: Valor da fatura`);
                if (entry.production < 0) errors.push(`Mês ${i + 1}: Produção solar`);
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
                if (v.daily_km < 0) errors.push(`Carro ${i + 1}: Km por dia`);
                if (v.consumption_kwh_per_km < 0) errors.push(`Carro ${i + 1}: Consumo`);
            });
        }

        // Investment Validation
        if (formData.max_investment !== '' && Number(formData.max_investment) < 0) {
            errors.push('Investimento Máximo');
        }

        if (formData.solar.roof_mapping?.enabled && !formData.solar.roof_mapping.polygon) {
            toast({
                title: 'Telhado em falta',
                description: 'Desenhe o polígono do telhado no mapa ou selecione "Não" nesta opção.',
                variant: 'destructive',
            });
            return;
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
                : mode === 'bill' ? getBillTariffPrices(formData.tariff.type, formData.bill)
                    : getDefaultTariffPrices(formData.tariff.type); // eredes uses default for pricing context if needed

            const tariffPayload = {
                type: formData.tariff.type,
                prices: tariffPrices,
            };

            const simulationInput = {
                ...(mode === 'house' ? formData.house : mode === 'bill' ? formData.bill : {}),
                site: {
                    area_m2: formData.house.area_m2,
                    floors: formData.house.floors,
                    occupants: formData.house.occupants,
                },
                electric_vehicles: formData.electric_vehicles,
            };

            if (mode === 'eredes') {
                if (!formData.eredes.csv_profile) {
                    toast({
                        title: 'Ficheiro em falta',
                        description: 'Por favor, faça o upload e processe o ficheiro E-Redes antes de simular.',
                        variant: 'destructive',
                    });
                    setLoading(false);
                    return;
                }
                (simulationInput as any).csv_profile = formData.eredes.csv_profile;
            }

            let cleanFormData = { ...formData };
            if (mode !== 'eredes') {
                cleanFormData.eredes = {
                    ...cleanFormData.eredes,
                    csv_profile: null // Don't send heavy profile if not in eredes mode
                };
            }

            const response = await fetch(getApiUrl('api/simulator/size'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    mode,
                    input: simulationInput,
                    tariff: tariffPayload,
                    solar: formData.solar,
                    max_investment: formData.max_investment ? Number(formData.max_investment) : null,
                    assumptions: { battery_dod: 0.9, system_losses: 0.1, component_margin: 0.1, installation_margin: 0.25 },
                    form_data: cleanFormData,
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
            goToStep(5, mode);
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

        const body = `Olá, \ngostaria de solicitar orçamentos para a instalação dos seguintes produtos sugeridos pela simulação:\n\n${products.join('\n')}\n\nLocal da casa: ${formData.solar.city}, ${formData.house.area_m2} m²\n\nObrigado.`;
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
        items: (results?.recommendations || []).filter((rec: any) => rec !== null && typeof rec === 'object' && rec.budget_tier === section.tier),
    }));

    const formatPrice = (value: any) => {
        const num = Number(String(value || 0).replace(',', '.'));
        if (isNaN(num)) return '0€';
        return `${Math.round(num).toLocaleString()}€`;
    };

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
    const roofMapDefaultQuery = [formData.solar.location, formData.solar.city, formData.solar.country].filter(Boolean).join(', ');
    const renderRoofMapPicker = () => (
        <React.Suspense fallback={<div className="pt-4 border-t border-gray-200 text-sm text-gray-500">A carregar mapa...</div>}>
            <RoofMapPicker
                value={formData.solar.roof_mapping}
                defaultQuery={roofMapDefaultQuery}
                onChange={(roofMapping) => setFormData({
                    ...formData,
                    solar: {
                        ...formData.solar,
                        roof_mapping: roofMapping,
                    },
                })}
            />
        </React.Suspense>
    );

    return (
        <div className="flex flex-col min-h-screen bg-white text-black">
            <SeoHead
                title="Simulador de Independência Energética | Watt Builder"
                description="Calcule a sua independência energética em menos de 2 minutos. Descubra o sistema ideal de baterias e painéis solares para a sua casa em Portugal ou Espanha."
                type="software"
            />
            <Navigation />

            <main className="flex-grow py-12">
                <div className="max-w-7xl mx-auto px-4">

                    {/* Progress Header */}
                    <div className="text-center mb-10 mt-20">
                        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-gray-900">
                            Simulador de Independência Energética
                        </h1>
                        <p className="mt-3 text-lg text-gray-500">
                            Descubra o sistema de baterias ideal para a sua casa em menos de 2 minutos.
                        </p>
                    </div>

                    {/* Stepper Visual */}
                    <div className="max-w-4xl mx-auto mb-12">
                        <Stepper
                            currentStep={step}
                            onStepClick={handleStepperClick}
                            steps={[
                                { title: 'Modo', description: 'Tipo de Simulação' },
                                { title: 'Habitação', description: 'Localização e Casa' },
                                { title: 'Solar', description: 'Telhado e Painéis' },
                                { title: 'Consumo', description: 'Perfil de Energia' },
                                { title: 'Resultado', description: 'As suas soluções' }
                            ]}
                        />
                    </div>

                    <div className="max-w-5xl mx-auto">
                        {/* Step 1: Selection */}
                        {step === 1 && (
                            <StepModeSelection
                                onSelect={(m) => goToStep(2, m)}
                                selectedMode={mode || undefined}
                            />
                        )}

                        {/* Step 2: House Data */}
                        {step === 2 && (
                            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                                <StepHouseData
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                                <div className="flex gap-3 pt-6 border-t border-gray-100">
                                    <Button variant="outline" className="h-12 px-8 border-gray-300 rounded-xl" onClick={() => goToStep(1, null)}>
                                        <ChevronLeft className="mr-2 w-4 h-4" /> Voltar
                                    </Button>
                                    <Button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white h-12 text-lg font-bold rounded-xl shadow-lg shadow-orange-100" onClick={() => goToStep(3)}>
                                        Continuar <ChevronRight className="ml-2 w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Solar & Map (Swapped) */}
                        {step === 3 && (
                            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                                <StepSolarData
                                    formData={formData}
                                    setFormData={setFormData}
                                    renderRoofMapPicker={renderRoofMapPicker}
                                    mode={mode || undefined}
                                />
                                <div className="flex gap-3 pt-8 border-t border-gray-100">
                                    <Button variant="outline" className="h-12 px-8 border-gray-300 rounded-xl" onClick={() => goToStep(2)}>
                                        <ChevronLeft className="mr-2 w-4 h-4" /> Voltar
                                    </Button>
                                    <Button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white h-12 text-lg font-bold rounded-xl shadow-lg shadow-orange-100" onClick={() => goToStep(4)}>
                                        Continuar <ChevronRight className="ml-2 w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Consumption & Specifics (Swapped) */}
                        {step === 4 && (
                            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="space-y-6 pt-8 border-t border-gray-100">
                                    <h3 className="text-xl font-bold text-gray-900">Configuração de Fatura / Tarifário</h3>

                                    <div className="space-y-4">
                                        <Label className="text-gray-900 font-bold uppercase tracking-tight">Tarifário</Label>
                                        <div className="grid grid-cols-3 gap-3 h-[52px]">
                                            {[
                                                { key: 'simple', label: 'Simples' },
                                                { key: 'bi', label: 'Bi-horário' },
                                                { key: 'tri', label: 'Tri-horário' }
                                            ].map((option) => (
                                                <Button
                                                    key={option.key}
                                                    variant={formData.tariff.type === option.key ? "default" : "outline"}
                                                    className={formData.tariff.type === option.key ? "bg-orange-600 hover:bg-orange-700" : "border-gray-200 text-gray-600"}
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

                                    {mode === 'eredes' && (
                                        <div className="space-y-6">
                                            <div className="p-8 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 text-center space-y-4">
                                                <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                                                    <Zap className="text-orange-600 w-8 h-8" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold">Upload E-Redes</h3>
                                                    <p className="text-sm text-gray-500 max-w-xs mx-auto">Selecione o ficheiro exportado do portal E-Redes (.csv ou .xlsx).</p>
                                                </div>
                                                <div className="flex flex-col items-center gap-2">
                                                    <Input
                                                        type="file"
                                                        accept=".csv, .xlsx, .xls"
                                                        onChange={handleFileUpload}
                                                        className="max-w-xs bg-white cursor-pointer h-[48px] file:h-full"
                                                        disabled={isUploading}
                                                    />
                                                    {formData.eredes.file_name && (
                                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 py-1.5 px-3">
                                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                                            {formData.eredes.file_name}
                                                        </Badge>
                                                    )}
                                                    {isUploading && <div className="flex items-center text-orange-600 text-sm font-medium"><Loader2 className="animate-spin w-4 h-4 mr-2" /> Processando...</div>}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {mode === 'bill' && (
                                        <div className="space-y-6">
                                            <FriendlyNumericInput
                                                label="Meses de Histórico"
                                                value={formData.bill.historyMonths}
                                                onChange={(val) => {
                                                    const months = Math.min(12, Math.max(1, val || 1));
                                                    const history = [...formData.bill.history];
                                                    if (history.length < months) {
                                                        history.push(...Array(months - history.length).fill(null).map(() => createHistoryEntry(formData.tariff.type)));
                                                    } else {
                                                        history.length = months;
                                                    }
                                                    setFormData({ ...formData, bill: { ...formData.bill, historyMonths: months, history } });
                                                }}
                                                min={1}
                                                max={12}
                                            />
                                            <div className="space-y-4">
                                                {formData.bill.history.slice(0, formData.bill.historyMonths).map((entry: any, index: number) => (
                                                    <Card key={index} className="border-gray-200 overflow-hidden shadow-sm">
                                                        <CardContent className="p-6">
                                                            <div className="flex justify-between items-center mb-6">
                                                                <h4 className="font-bold text-gray-900">Dados do Mês {index + 1}</h4>
                                                                <Badge variant="secondary" className="bg-gray-100">Fatura Mensal</Badge>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                                                <FriendlyNumericInput
                                                                    label="Valor Fatura"
                                                                    value={entry.bill_total}
                                                                    onChange={(val) => {
                                                                        const history = [...formData.bill.history];
                                                                        history[index] = { ...history[index], bill_total: val };
                                                                        setFormData({ ...formData, bill: { ...formData.bill, history } });
                                                                    }}
                                                                    unit="€"
                                                                />
                                                                <FriendlyNumericInput
                                                                    label="Consumo"
                                                                    value={entry.simple || entry.offPeak || 0}
                                                                    onChange={(val) => {
                                                                        const history = [...formData.bill.history];
                                                                        if (formData.tariff.type === 'simple') history[index] = { ...history[index], simple: val };
                                                                        else history[index] = { ...history[index], offPeak: val };
                                                                        setFormData({ ...formData, bill: { ...formData.bill, history } });
                                                                    }}
                                                                    unit="kWh"
                                                                />
                                                                {formData.solar.has_solar && (
                                                                    <FriendlyNumericInput
                                                                        label="Produção Solar"
                                                                        value={entry.production || 0}
                                                                        onChange={(val) => {
                                                                            const history = [...formData.bill.history];
                                                                            history[index] = { ...history[index], production: val };
                                                                            setFormData({ ...formData, bill: { ...formData.bill, history } });
                                                                        }}
                                                                        unit="kWh"
                                                                    />
                                                                )}
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {mode === 'house' && (
                                        <div className="space-y-6">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div>
                                                    <Label className="text-lg font-bold text-gray-900">Pretende inserir os dados da última fatura?</Label>
                                                    <p className="text-sm text-gray-500">Usamos esses dados para estimar o preço por kWh.</p>
                                                </div>
                                                <div className="flex gap-2 h-[48px] md:w-48">
                                                    <Button
                                                        variant={formData.house.use_last_bill ? "outline" : "default"}
                                                        className={formData.house.use_last_bill ? "flex-1 border-gray-200" : "flex-1 bg-orange-600 hover:bg-orange-700"}
                                                        onClick={() => setFormData({ ...formData, house: { ...formData.house, use_last_bill: false } })}
                                                    >
                                                        Não
                                                    </Button>
                                                    <Button
                                                        variant={formData.house.use_last_bill ? "default" : "outline"}
                                                        className={formData.house.use_last_bill ? "flex-1 bg-orange-600 hover:bg-orange-700" : "flex-1 border-gray-200"}
                                                        onClick={() => setFormData({ ...formData, house: { ...formData.house, use_last_bill: true } })}
                                                    >
                                                        Sim
                                                    </Button>
                                                </div>
                                            </div>

                                            {formData.house.use_last_bill && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-top-4 duration-300">
                                                    {activeTariffPeriods.map((period) => (
                                                        <FriendlyNumericInput
                                                            key={period.key}
                                                            label={period.label}
                                                            value={formData.house.last_bill.consumption[period.key] ?? 0}
                                                            onChange={(val) => setFormData({
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
                                                            })}
                                                            unit="kWh"
                                                        />
                                                    ))}
                                                    <FriendlyNumericInput
                                                        label="Valor Total"
                                                        value={formData.house.last_bill.total}
                                                        onChange={(val) => setFormData({
                                                            ...formData,
                                                            house: {
                                                                ...formData.house,
                                                                last_bill: {
                                                                    ...formData.house.last_bill,
                                                                    total: val,
                                                                },
                                                            },
                                                        })}
                                                        unit="€"
                                                    />
                                                    {formData.solar.has_solar && (
                                                        <FriendlyNumericInput
                                                            label="Produção Solar"
                                                            value={formData.house.last_bill.production || 0}
                                                            onChange={(val) => setFormData({
                                                                ...formData,
                                                                house: {
                                                                    ...formData.house,
                                                                    last_bill: {
                                                                        ...formData.house.last_bill,
                                                                        production: val,
                                                                    },
                                                                },
                                                            })}
                                                            unit="kWh"
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="pt-6 border-t border-gray-100">
                                        <Label className="text-gray-900 font-bold uppercase tracking-tight">Tipo de Instalação Elétrica</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 h-[52px]">
                                            <Button
                                                variant={formData.solar.grid_type === 'single_phase' ? "default" : "outline"}
                                                className={formData.solar.grid_type === 'single_phase' ? "bg-orange-600 hover:bg-orange-700" : "border-gray-200"}
                                                onClick={() => setFormData({ ...formData, solar: { ...formData.solar, grid_type: 'single_phase' } })}
                                            >
                                                Monofásica (1 fase)
                                            </Button>
                                            <Button
                                                variant={formData.solar.grid_type === 'three_phase' ? "default" : "outline"}
                                                className={formData.solar.grid_type === 'three_phase' ? "bg-orange-600 hover:bg-orange-700" : "border-gray-200"}
                                                onClick={() => setFormData({ ...formData, solar: { ...formData.solar, grid_type: 'three_phase' } })}
                                            >
                                                Trifásica (3 fases)
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="pt-8 border-t border-gray-100">
                                        <StepConsumptionData
                                            formData={formData}
                                            setFormData={setFormData}
                                            addElectricVehicle={addElectricVehicle}
                                            removeElectricVehicle={removeElectricVehicle}
                                            updateElectricVehicle={updateElectricVehicle}
                                        />
                                    </div>

                                    <div className="space-y-4 pt-8 border-t border-gray-100">
                                        <Label className="text-gray-900 font-bold uppercase tracking-tight">Investimento Máximo (Opcional)</Label>
                                        <div className="relative max-w-sm">
                                            <Input
                                                type="number"
                                                placeholder="Ex: 5000"
                                                className="h-12 border-gray-300 focus-visible:ring-orange-600 pr-10 rounded-xl"
                                                value={formData.max_investment}
                                                onChange={(e) => setFormData({ ...formData, max_investment: e.target.value })}
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
                                        </div>
                                        <p className="text-xs text-gray-400">Deixe em branco para ver todas as opções tecnológicas.</p>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-8 border-t border-gray-100">
                                    <Button variant="outline" className="h-12 px-8 border-gray-300 rounded-xl" onClick={() => goToStep(3)}>
                                        <ChevronLeft className="mr-2 w-4 h-4" /> Voltar
                                    </Button>
                                    <Button
                                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white h-12 text-lg font-bold rounded-xl shadow-lg shadow-orange-100"
                                        onClick={runSimulation}
                                        disabled={loading}
                                    >
                                        {loading ? <Loader2 className="animate-spin mr-2" /> : <><Zap className="w-5 h-5 mr-2" /> Gerar Recomendação</>}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 5: Results */}
                        {step === 5 && results && (
                            <div className="space-y-8 animate-in zoom-in-95 duration-500 max-w-7xl mx-auto">
                                {loading ? (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-center space-y-4">
                                                <div className="relative">
                                                    <div className="w-20 h-20 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin mx-auto" />
                                                    <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-600 w-8 h-8" />
                                                </div>
                                                <h3 className="text-xl font-bold text-gray-900">Calculando a sua independência...</h3>
                                                <p className="text-gray-500">O nosso algoritmo está a analisar milhares de combinações.</p>
                                            </div>
                                        </div>
                                        <ResultsSkeleton />
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <h2 className="text-3xl font-bold text-gray-900">Análise de Resultados</h2>
                                                <p className="text-gray-500">Explore as melhores sugestões para a sua casa.</p>
                                            </div>
                                            <Button
                                                onClick={handlePremiumInterest}
                                                className="bg-black hover:bg-gray-800 text-white h-12 px-6 rounded-xl shadow-xl transition-all active:scale-95"
                                                disabled={isSubmittingPremium || !results?.recommendations?.length}
                                            >
                                                {isSubmittingPremium ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <FileText className="mr-2 h-4 w-4" />
                                                )}
                                                Relatório Técnico Detalhado
                                            </Button>
                                            {isAdminMode && results?.debug_series && (
                                                <Button
                                                    onClick={downloadDebugCSV}
                                                    variant="outline"
                                                    className="border-orange-200 text-orange-700 hover:bg-orange-50 h-12 rounded-xl"
                                                >
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Exportar CSV (Debug)
                                                </Button>
                                            )}
                                        </div>

                                        {isAdminMode && results?.debug_series && (
                                            <DebugSimulationChart data={results.debug_series} />
                                        )}

                                        {/* Retrofit Match Warning */}
                                        {results?.summary?.retrofit_match && !results.summary.retrofit_match.matched_id && (
                                            <Alert className="bg-amber-50 border-amber-200 text-amber-900 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 rounded-2xl">
                                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                                                <div className="ml-2">
                                                    <AlertTitle className="font-bold flex items-center gap-2">
                                                        Equipamento atual não reconhecido
                                                    </AlertTitle>
                                                    <AlertDescription className="mt-1 text-amber-800 leading-relaxed">
                                                        Não conseguimos identificar com total certeza o modelo <strong>{results.summary.retrofit_match.brand} {results.summary.retrofit_match.model}</strong> na nossa base de dados técnica.
                                                        <br />
                                                        Por segurança, as soluções abaixo incluem a <strong>substituição total do inversor</strong> para garantir compatibilidade a 100%. Se o seu equipamento atual for recente, contacte-nos para avaliarmos um orçamento personalizado reaproveitando o seu hardware.
                                                    </AlertDescription>
                                                </div>
                                            </Alert>
                                        )}

                                        <Tabs defaultValue="best" value={activeTab} onValueChange={setActiveTab} className="w-full">
                                            <TabsList className="grid w-full max-w-md grid-cols-2 mb-8 h-12 p-1 bg-gray-100 rounded-xl">
                                                <TabsTrigger value="best" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                                    <LayoutGrid className="w-4 h-4 mr-2" />
                                                    Melhores Sugestões
                                                </TabsTrigger>
                                                <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                                    <LucideLineChart className="w-4 h-4 mr-2" />
                                                    Todas as Soluções
                                                </TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="best" className="space-y-10 focus-visible:outline-none focus-visible:ring-0">
                                                {results?.recommendations?.length === 0 ? (
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
                                                            className="mt-4 border-orange-500 text-orange-900 hover:bg-orange-100 h-12 rounded-xl"
                                                            onClick={() => goToStep(2)}
                                                        >
                                                            Ajustar Parâmetros
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    recommendationGroups.map((group) => (
                                                        group.items.length > 0 && (
                                                            <section key={group.tier} className="space-y-4">
                                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-gray-200 pb-2">
                                                                    <div>
                                                                        <div className="flex items-center gap-3">
                                                                            <h2 className="text-xl font-extrabold tracking-tight text-gray-900">{group.title}</h2>
                                                                            <Badge variant="outline" className={cn("font-bold", group.badgeClass)}>
                                                                                {group.items.length} opções
                                                                            </Badge>
                                                                        </div>
                                                                        <p className="text-sm text-gray-500">{group.description}</p>
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                                    {group.items.map((rec: any, idx: number) => (
                                                                        <Card
                                                                            key={`${group.tier}-${rec.system_name || rec.battery?.id || idx}`}
                                                                            onClick={() => setSelectedRecommendation(rec)}
                                                                            className="cursor-pointer relative overflow-hidden transition-all hover:scale-[1.02] hover:shadow-xl bg-white flex flex-col h-full border-gray-200 rounded-2xl group"
                                                                        >
                                                                            <CardHeader className="p-6 pb-2">
                                                                                <CardTitle className="text-xl leading-tight text-gray-900">Solução {idx + 1}</CardTitle>
                                                                                <CardDescription className="text-sm mt-1 line-clamp-2 text-gray-500">
                                                                                    {getBatteryDescription(rec)}
                                                                                    {rec.inverter && ` • Inv. ${rec.inverter.brand}`}
                                                                                    {rec.solar_panels && ` • ${rec.solar_panels.quantity} Painéis`}
                                                                                </CardDescription>
                                                                            </CardHeader>

                                                                            <CardContent className="p-6 pt-2 flex-grow flex flex-col gap-6">
                                                                                <div className="flex items-baseline gap-1 border-b border-gray-100 pb-4">
                                                                                    <span className="text-3xl font-black text-gray-900">{formatPrice(rec.capex_total_eur)}</span>
                                                                                    <span className="text-gray-400 text-xs font-bold uppercase">est.</span>
                                                                                </div>

                                                                                <div className="grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-4 text-sm border border-gray-100">
                                                                                    <div>
                                                                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Poupança</p>
                                                                                        <p className="font-bold text-emerald-600 text-lg">{formatPrice(rec.savings_annual_eur)}/ano</p>
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Retorno</p>
                                                                                        <p className="font-bold text-gray-900 text-lg">{rec.payback_years ? `${rec.payback_years} anos` : 'N/A'}</p>
                                                                                    </div>
                                                                                </div>

                                                                                {rec.tariff_optimization && (
                                                                                    <div className="absolute top-4 right-4 p-2 rounded-full bg-orange-100 border border-orange-200 text-orange-600 shadow-sm animate-pulse" title={`Dica de Otimização: Mude para ${rec.tariff_optimization.recommended_type === 'bi' ? 'Bi-horário' : rec.tariff_optimization.recommended_type === 'tri' ? 'Tri-horário' : 'Simples'}`}>
                                                                                        <Lightbulb className="w-5 h-5" />
                                                                                    </div>
                                                                                )}

                                                                                <div className="flex flex-col gap-2 mt-auto">
                                                                                    <Button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleRequestQuote(rec);
                                                                                        }}
                                                                                        className="w-full bg-white border-2 border-gray-200 text-gray-900 hover:bg-gray-50 hover:border-orange-200 h-12 font-bold rounded-xl transition-all"
                                                                                        size="sm"
                                                                                    >
                                                                                        Solicitar orçamentos
                                                                                    </Button>
                                                                                </div>
                                                                            </CardContent>
                                                                        </Card>
                                                                    ))}
                                                                </div>
                                                            </section>
                                                        )
                                                    ))
                                                )}
                                            </TabsContent>

                                            <TabsContent value="all" className="focus-visible:outline-none focus-visible:ring-0">
                                                <Card className="border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                                    <CardHeader className="pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50 border-b border-gray-100">
                                                        <div>
                                                            <CardTitle className="text-xl font-bold text-gray-900">Todas as Soluções Geradas</CardTitle>
                                                            <CardDescription className="text-gray-500">
                                                                Analise como as diferentes variáveis se relacionam em todas as soluções tecnicamente viáveis.
                                                            </CardDescription>
                                                        </div>
                                                        <div className="flex bg-gray-200/50 p-1 rounded-xl">
                                                            <Button
                                                                variant={allSolutionsView === 'chart' ? 'secondary' : 'ghost'}
                                                                size="sm"
                                                                onClick={() => setAllSolutionsView('chart')}
                                                                className={`rounded-lg h-9 px-4 ${allSolutionsView === 'chart' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                                                            >
                                                                <LucideLineChart className="w-4 h-4 mr-2" />
                                                                Gráfico
                                                            </Button>
                                                            <Button
                                                                variant={allSolutionsView === 'table' ? 'secondary' : 'ghost'}
                                                                size="sm"
                                                                onClick={() => setAllSolutionsView('table')}
                                                                className={`rounded-lg h-9 px-4 ${allSolutionsView === 'table' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                                                            >
                                                                <LayoutGrid className="w-4 h-4 mr-2" />
                                                                Tabela
                                                            </Button>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-6 space-y-8">
                                                        {/* Filtros Avançados */}
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <Label className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mr-2">Filtrar por</Label>
                                                            {[
                                                                { id: 'all', label: 'Todas', icon: Sparkles },
                                                                { id: 'battery_only', label: 'Só Bateria', icon: Battery },
                                                                { id: 'solar_only', label: 'Só Painéis', icon: Sun },
                                                                { id: 'hybrid', label: 'Híbridas', icon: Zap },
                                                            ].map((f) => {
                                                                const Icon = f.icon;
                                                                return (
                                                                    <Button
                                                                        key={f.id}
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => setFilterType(f.id as any)}
                                                                        className={`h-10 rounded-xl px-5 border-gray-200 transition-all font-medium ${filterType === f.id ? 'bg-orange-600 border-orange-600 text-white hover:bg-orange-700' : 'bg-white text-gray-600 hover:border-gray-400 hover:text-gray-900'}`}
                                                                    >
                                                                        <Icon className={`w-4 h-4 mr-2 ${filterType === f.id ? 'text-white' : 'text-orange-500'}`} />
                                                                        {f.label}
                                                                    </Button>
                                                                );
                                                            })}
                                                        </div>

                                                        {allSolutionsView === 'chart' ? (
                                                            <>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                                                    <div className="space-y-3">
                                                                        <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest">Eixo X (Horizontal)</Label>
                                                                        <Select value={xAxis} onValueChange={setXAxis}>
                                                                            <SelectTrigger className="bg-white border-gray-200 shadow-sm h-12 rounded-xl text-gray-900 font-medium">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent className="bg-white">
                                                                                <SelectItem value="new_battery_capacity_kwh">Energia da bateria (kWh)</SelectItem>
                                                                                <SelectItem value="panel_power_kwp">Potência dos painéis (kWp)</SelectItem>
                                                                                <SelectItem value="capex_total_eur">Custo total (€)</SelectItem>
                                                                                <SelectItem value="payback_years">Anos de retorno</SelectItem>
                                                                                <SelectItem value="cost_per_kwh_battery">€/kWh da bateria</SelectItem>
                                                                                <SelectItem value="cost_per_kwp_panels">€/kWp dos painéis</SelectItem>
                                                                                <SelectItem value="max_system_power_kw">Máxima potência do sistema (kW)</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="space-y-3">
                                                                        <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest">Eixo Y (Vertical)</Label>
                                                                        <Select value={yAxis} onValueChange={setYAxis}>
                                                                            <SelectTrigger className="bg-white border-gray-200 shadow-sm h-12 rounded-xl text-gray-900 font-medium">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent className="bg-white">
                                                                                <SelectItem value="new_battery_capacity_kwh">Energia da bateria (kWh)</SelectItem>
                                                                                <SelectItem value="panel_power_kwp">Potência dos painéis (kWp)</SelectItem>
                                                                                <SelectItem value="capex_total_eur">Custo total (€)</SelectItem>
                                                                                <SelectItem value="payback_years">Anos de retorno</SelectItem>
                                                                                <SelectItem value="cost_per_kwh_battery">€/kWh da bateria</SelectItem>
                                                                                <SelectItem value="cost_per_kwp_panels">€/kWp dos painéis</SelectItem>
                                                                                <SelectItem value="max_system_power_kw">Máxima potência do sistema (kW)</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                </div>

                                                                <div className="h-[550px] w-full mt-6 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm relative group/chart">
                                                                    <ResponsiveContainer width="100%" height="100%">
                                                                        <ScatterChart margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
                                                                            <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#f3f4f6" />
                                                                            <XAxis
                                                                                type="number"
                                                                                dataKey={xAxis}
                                                                                name={xAxis}
                                                                                stroke="#94a3b8"
                                                                                fontSize={11}
                                                                                tickLine={false}
                                                                                axisLine={false}
                                                                                tickFormatter={(val) => xAxis.includes('eur') || xAxis.includes('cost') ? `${val}€` : val}
                                                                                label={{ value: xAxis.replace(/_/g, ' '), position: 'bottom', offset: 0, fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                                                                            />
                                                                            <YAxis
                                                                                type="number"
                                                                                dataKey={yAxis}
                                                                                name={yAxis}
                                                                                stroke="#94a3b8"
                                                                                fontSize={11}
                                                                                tickLine={false}
                                                                                axisLine={false}
                                                                                tickFormatter={(val) => yAxis.includes('eur') || yAxis.includes('cost') ? `${val}€` : val}
                                                                                label={{ value: yAxis.replace(/_/g, ' '), angle: -90, position: 'left', offset: 10, fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                                                                            />
                                                                            <ZAxis type="number" range={[150, 150]} />
                                                                            <ChartTooltip
                                                                                cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }}
                                                                                content={({ active, payload }) => {
                                                                                    if (active && payload && payload.length) {
                                                                                        const data = payload[0].payload;
                                                                                        const isHybrid = data.new_battery_added && data.new_panels_added;
                                                                                        const isSolarOnly = !data.new_battery_added && data.new_panels_added;
                                                                                        const isBatteryOnly = data.new_battery_added && !data.new_panels_added;

                                                                                        return (
                                                                                            <div className="bg-white/95 backdrop-blur-md p-6 border border-gray-200 shadow-2xl rounded-2xl min-w-[300px] animate-in zoom-in-95 duration-200">
                                                                                                <div className="flex items-center justify-between mb-4">
                                                                                                    <Badge className={cn("font-bold px-3 py-1", isHybrid ? 'bg-orange-600' : isSolarOnly ? 'bg-blue-600' : 'bg-emerald-600')}>
                                                                                                        {isHybrid ? 'Híbrido' : isSolarOnly ? 'Só Solar' : 'Só Bateria'}
                                                                                                    </Badge>
                                                                                                    <span className="text-2xl font-black text-gray-900">{formatPrice(data.capex_total_eur)}</span>
                                                                                                </div>

                                                                                                <div className="space-y-4">
                                                                                                    <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                                                                                        {data.new_battery_added && data.battery && (
                                                                                                            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                                                                                                <Battery className="w-4 h-4 text-orange-600" />
                                                                                                                <span className="truncate">{getBatteryDescription(data)}</span>
                                                                                                            </div>
                                                                                                        )}
                                                                                                        {data.inverter && (
                                                                                                            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                                                                                                <Zap className="w-4 h-4 text-blue-600" />
                                                                                                                <span className="truncate">
                                                                                                                    {data.inverter.brand} {data.inverter.model}
                                                                                                                    {data.is_retrofit && <span className="ml-1 text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-black uppercase">Retrofit</span>}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                        )}
                                                                                                        {data.new_panels_added && data.solar_panels && (
                                                                                                            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                                                                                                <Sun className="w-4 h-4 text-amber-500" />
                                                                                                                <span className="truncate">{data.solar_panels.quantity}x {data.solar_panels.panel?.brand || 'Painéis'}</span>
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>

                                                                                                    <div className="grid grid-cols-2 gap-4 text-xs font-bold">
                                                                                                        <div className="flex flex-col gap-1">
                                                                                                            <span className="text-gray-400 uppercase text-[9px] tracking-widest font-black">Payback</span>
                                                                                                            <span className="text-gray-900 text-sm">{data.payback_years} anos</span>
                                                                                                        </div>
                                                                                                        <div className="flex flex-col gap-1">
                                                                                                            <span className="text-gray-400 uppercase text-[9px] tracking-widest font-black">Poupança Anual</span>
                                                                                                            <span className="text-emerald-600 text-sm">{formatPrice(data.savings_annual_eur)}</span>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <p className="text-[10px] text-orange-600 font-black text-center mt-3 animate-pulse border-t border-orange-50 pt-3">CLIQUE PARA DETALHES COMPLETOS</p>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    }
                                                                                    return null;
                                                                                }}
                                                                            />
                                                                            <Scatter
                                                                                name="Híbridas"
                                                                                data={filteredRecommendations.filter(r => r.new_battery_added && r.new_panels_added)}
                                                                                fill="#ea580c"
                                                                                size={100}
                                                                                className="cursor-pointer"
                                                                                onClick={(data) => setSelectedRecommendation(data.payload)}
                                                                            />
                                                                            <Scatter
                                                                                name="Só Bateria"
                                                                                data={filteredRecommendations.filter(r => r.new_battery_added && !r.new_panels_added)}
                                                                                fill="#10b981"
                                                                                size={100}
                                                                                className="cursor-pointer"
                                                                                onClick={(data) => setSelectedRecommendation(data.payload)}
                                                                            />
                                                                            <Scatter
                                                                                name="Só Solar"
                                                                                data={filteredRecommendations.filter(r => !r.new_battery_added && r.new_panels_added)}
                                                                                fill="#2563eb"
                                                                                size={100}
                                                                                className="cursor-pointer"
                                                                                onClick={(data) => setSelectedRecommendation(data.payload)}
                                                                            />
                                                                        </ScatterChart>
                                                                    </ResponsiveContainer>
                                                                </div>

                                                                <div className="flex justify-center gap-8 mt-4 pb-2">
                                                                    <div className="flex items-center gap-2.5">
                                                                        <div className="w-3.5 h-3.5 rounded-full bg-orange-600 shadow-sm" />
                                                                        <span className="text-[11px] font-black uppercase text-gray-600 tracking-wider">Híbrida</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2.5">
                                                                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm" />
                                                                        <span className="text-[11px] font-black uppercase text-gray-600 tracking-wider">Só Bateria</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2.5">
                                                                        <div className="w-3.5 h-3.5 rounded-full bg-blue-600 shadow-sm" />
                                                                        <span className="text-[11px] font-black uppercase text-gray-600 tracking-wider">Só Solar</span>
                                                                    </div>
                                                                </div>

                                                                <p className="text-center text-[10px] text-gray-400 italic">
                                                                    * Passe com o rato nos pontos para ver o resumo. Clique para ver o relatório completo de cada solução.
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm bg-white font-sans">
                                                                <div className="overflow-x-auto">
                                                                    <Table>
                                                                        <TableHeader>
                                                                            <TableRow className="bg-gray-50 hover:bg-gray-50 text-[10px]">
                                                                                <TableHead className="font-bold text-gray-400 uppercase tracking-widest px-4">Bateria</TableHead>
                                                                                <TableHead className="font-bold text-gray-400 uppercase tracking-widest">Inversor</TableHead>
                                                                                <TableHead className="font-bold text-gray-400 uppercase tracking-widest">Painéis</TableHead>
                                                                                <TableHead className="font-bold text-gray-400 uppercase tracking-widest text-right cursor-pointer hover:text-orange-600 transition-colors" onClick={() => handleSort('capex_total_eur')}>
                                                                                    Custo (€) {sortConfig?.key === 'capex_total_eur' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                                                                </TableHead>
                                                                                <TableHead className="font-bold text-gray-400 uppercase tracking-widest text-right cursor-pointer hover:text-orange-600 transition-colors" onClick={() => handleSort('payback_years')}>
                                                                                    Payback (Anos) {sortConfig?.key === 'payback_years' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                                                                </TableHead>
                                                                                <TableHead className="font-bold text-gray-400 uppercase tracking-widest text-right cursor-pointer hover:text-orange-600 transition-colors" onClick={() => handleSort('new_battery_capacity_kwh')}>
                                                                                    Bat. (kWh) {sortConfig?.key === 'new_battery_capacity_kwh' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                                                                </TableHead>
                                                                                <TableHead className="font-bold text-gray-400 uppercase tracking-widest text-right cursor-pointer hover:text-orange-600 transition-colors" onClick={() => handleSort('panel_power_kwp')}>
                                                                                    Sol. (kWp) {sortConfig?.key === 'panel_power_kwp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                                                                </TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {sortedRecommendations.map((data: any, idx: number) => (
                                                                                <TableRow
                                                                                    key={idx}
                                                                                    className="cursor-pointer hover:bg-orange-50/50 transition-colors text-sm font-medium text-gray-700"
                                                                                    onClick={() => setSelectedRecommendation(data)}
                                                                                >
                                                                                    <TableCell className="px-4">
                                                                                        {data.battery ? (
                                                                                            <div className="flex items-center gap-2">
                                                                                                <Battery className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                                                                                                <div>
                                                                                                    <div className="font-bold text-gray-900 truncate max-w-[140px] uppercase tracking-tighter">{data.battery.brand} {data.battery.model}</div>
                                                                                                    <div className="text-gray-400 text-[10px] font-medium">Qtd: {data.battery.quantity || 1}</div>
                                                                                                </div>
                                                                                            </div>
                                                                                        ) : <span className="text-gray-400 font-normal italic">Sem bateria</span>}
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        {data.inverter ? (
                                                                                            <div className="flex items-center gap-2">
                                                                                                <Zap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                                                                <div>
                                                                                                    <div className="font-bold text-gray-900 truncate max-w-[140px] uppercase tracking-tighter">{data.inverter.brand} {data.inverter.model}</div>
                                                                                                    <div className="text-gray-400 text-[10px] font-medium">Qtd: {data.inverter.quantity || 1}</div>
                                                                                                </div>
                                                                                            </div>
                                                                                        ) : ''}
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        {data.solar_panels ? (
                                                                                            <div className="flex items-center gap-2">
                                                                                                <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                                                                <div>
                                                                                                    <div className="font-bold text-gray-900 truncate max-w-[140px] uppercase tracking-tighter">{data.solar_panels.panel?.brand} {data.solar_panels.panel?.model}</div>
                                                                                                    <div className="text-gray-400 text-[10px] font-medium">Qtd: {data.solar_panels.quantity}</div>
                                                                                                </div>
                                                                                            </div>
                                                                                        ) : <span className="text-gray-400 font-normal italic">Sem painéis</span>}
                                                                                    </TableCell>
                                                                                    <TableCell className="text-right font-bold text-gray-900 text-sm whitespace-nowrap">{Math.round(data.capex_total_eur).toLocaleString()}€</TableCell>
                                                                                    <TableCell className="text-right font-bold text-gray-900">{data.payback_years}</TableCell>
                                                                                    <TableCell className="text-right font-bold text-orange-600">{data.new_battery_capacity_kwh} kWh</TableCell>
                                                                                    <TableCell className="text-right font-bold text-blue-600">{data.panel_power_kwp} kWp</TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                                {sortedRecommendations.length === 0 && (
                                                                    <div className="p-16 text-center bg-gray-50/50">
                                                                        <div className="bg-gray-200 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
                                                                            <Info className="text-gray-400 w-8 h-8" />
                                                                        </div>
                                                                        <p className="text-gray-500 font-bold text-lg">Nenhuma solução encontrada com este filtro.</p>
                                                                        <Button variant="link" onClick={() => setFilterType('all')} className="text-orange-600 font-black mt-2 h-12 uppercase tracking-widest text-xs">Ver todas as soluções</Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </TabsContent>
                                        </Tabs>

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
                                        <div className="bg-white p-10 rounded-[2.5rem] border-2 border-orange-100 shadow-xl shadow-orange-50/50 text-center space-y-8 max-w-4xl mx-auto relative overflow-hidden group">
                                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-200 via-orange-500 to-orange-200" />
                                            {!hasRated ? (
                                                <>
                                                    <div className="space-y-3">
                                                        <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">O que achou destas soluções?</h3>
                                                        <p className="text-gray-500 font-medium">A sua avaliação ajuda-nos a melhorar o nosso algoritmo.</p>
                                                    </div>

                                                    <div className="flex flex-wrap justify-center gap-3">
                                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                                                            <button
                                                                key={star}
                                                                type="button"
                                                                onClick={() => {
                                                                    setUserRating(star);
                                                                    handleRatingSubmit(star, undefined, false);
                                                                }}
                                                                className={cn(
                                                                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all font-black text-lg border-2 shadow-sm active:scale-90",
                                                                    userRating === star
                                                                        ? 'bg-orange-600 text-white border-orange-700 shadow-orange-200 scale-110'
                                                                        : 'bg-white text-gray-400 border-gray-100 hover:border-orange-200 hover:text-orange-600 hover:bg-orange-50'
                                                                )}
                                                            >
                                                                {star}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {userRating !== null && userRating <= 9 && (
                                                        <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-10 pt-10 max-w-2xl mx-auto border-t border-gray-100 text-left">
                                                            {FEEDBACK_FORM_QUESTIONS.map((q) => (
                                                                <div key={q.id} className="space-y-4">
                                                                    <Label className="text-lg font-black text-gray-900 flex items-center gap-3">
                                                                        <div className="w-2 h-6 bg-orange-500 rounded-full" />
                                                                        {q.question}
                                                                    </Label>
                                                                    <div className="grid grid-cols-1 gap-3">
                                                                        {q.options.map((option) => (
                                                                            <div
                                                                                key={option}
                                                                                className={cn(
                                                                                    "flex items-start space-x-4 p-4 rounded-2xl border-2 transition-all cursor-pointer group/opt",
                                                                                    (feedbackQuestions[q.id] || []).includes(option)
                                                                                        ? 'border-orange-500 bg-orange-50 shadow-sm'
                                                                                        : 'border-gray-50 bg-white hover:border-orange-200'
                                                                                )}
                                                                                onClick={() => {
                                                                                    const current = feedbackQuestions[q.id] || [];
                                                                                    const next = current.includes(option)
                                                                                        ? current.filter(item => item !== option)
                                                                                        : [...current, option];
                                                                                    setFeedbackQuestions({ ...feedbackQuestions, [q.id]: next });
                                                                                }}
                                                                            >
                                                                                <Checkbox
                                                                                    id={`${q.id}-${option}`}
                                                                                    checked={(feedbackQuestions[q.id] || []).includes(option)}
                                                                                    className="mt-0.5 border-2 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                                                                                    onCheckedChange={() => { }} // Handled by div onClick
                                                                                />
                                                                                <label
                                                                                    htmlFor={`${q.id}-${option}`}
                                                                                    className="text-sm font-bold text-gray-700 cursor-pointer w-full leading-relaxed"
                                                                                >
                                                                                    {option}
                                                                                </label>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            <div className="space-y-4 pt-6">
                                                                <Label className="text-lg font-black text-gray-900 flex items-center gap-3">
                                                                    <div className="w-2 h-6 bg-orange-500 rounded-full" />
                                                                    Algo mais que queira partilhar? (Opcional)
                                                                </Label>
                                                                <Textarea
                                                                    value={ratingComment}
                                                                    onChange={(e) => setRatingComment(e.target.value)}
                                                                    placeholder="Diga-nos o que faltou ou o que poderia ser melhor..."
                                                                    className="mt-2 bg-gray-50 border-gray-100 rounded-2xl p-5 text-gray-900 font-medium focus:ring-orange-500 focus:bg-white transition-all min-h-[120px]"
                                                                />
                                                            </div>
                                                            <Button
                                                                onClick={() => handleRatingSubmit(userRating, ratingComment, true)}
                                                                disabled={isSendingRating}
                                                                className="w-full bg-orange-600 hover:bg-orange-700 text-white h-14 text-xl font-black rounded-2xl shadow-xl shadow-orange-100 uppercase tracking-widest transition-all active:scale-95"
                                                            >
                                                                {isSendingRating ? <Loader2 className="animate-spin w-6 h-6" /> : 'Submeter Feedback'}
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {userRating !== null && userRating > 9 && (
                                                        <div className="animate-in fade-in zoom-in duration-500 pt-4">
                                                            <p className="text-emerald-600 font-black text-xl uppercase tracking-tighter">Muito obrigado pela sua avaliação máxima! 🚀</p>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="py-8 animate-in zoom-in duration-700">
                                                    <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-50">
                                                        <CheckCircle2 className="w-12 h-12" />
                                                    </div>
                                                    <h3 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Feedback Recebido!</h3>
                                                    <p className="text-gray-500 font-bold mt-2 text-lg">A sua opinião é o motor da nossa evolução constante.</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 text-sm text-gray-500 space-y-4 max-w-4xl mx-auto">
                                            <h4 className="font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                                <Info className="w-4 h-4 text-orange-600" />
                                                Notas da Simulação
                                            </h4>
                                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                                                {(results.notes || []).map((note: string, index: number) => (
                                                    <li key={index} className="flex gap-2 items-start leading-relaxed font-medium">
                                                        <span className="text-orange-500 font-black">•</span>
                                                        {note}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="text-center py-10">
                                            <Button
                                                variant="ghost"
                                                onClick={() => goToStep(1, null)}
                                                className="text-gray-400 hover:text-orange-600 font-black uppercase tracking-widest text-xs h-12 rounded-xl transition-all"
                                            >
                                                <ChevronLeft className="w-4 h-4 mr-2" />
                                                Refazer Simulação Completa
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 4 Old Content (redundant, handled above, but keeping structure for safety during migration) */}
                        {/* Waiting List Section - Always visible at bottom of results or final steps */}
                        {step >= 4 && (
                            <section className="mt-24 p-12 bg-white rounded-[3rem] text-gray-900 relative overflow-hidden max-w-7xl mx-auto shadow-2xl shadow-orange-100/20 border border-orange-100 group">
                                <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_20%,rgba(249,115,22,0.05),transparent)] z-0" />
                                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <h2 className="text-4xl font-black uppercase tracking-tighter leading-none text-gray-900">
                                                Deseja um <span className="text-orange-600">Relatório Técnico</span> Completo?
                                            </h2>
                                            <p className="text-gray-600 text-lg font-medium leading-relaxed">
                                                A nossa equipa realiza um estudo detalhado e perfil de carga específico para a sua empresa ou habitação, incluindo análise de faturas reais e projeção de ROI a 20 anos.
                                            </p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Input
                                                value={reportEmail}
                                                onChange={(e) => setReportEmail(e.target.value)}
                                                placeholder="Introduza o seu email profissional"
                                                className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-orange-500 h-14 rounded-2xl px-6 text-lg font-bold"
                                            />
                                            <Button onClick={handleSendReportEmail} disabled={isSendingReportEmail} className="bg-orange-600 text-white hover:bg-orange-700 px-10 h-14 text-lg font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-orange-100 transition-all active:scale-95 shrink-0">
                                                {isSendingReportEmail ? <Loader2 className="animate-spin w-6 h-6" /> : 'Receber Estudo'}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="bg-orange-50/50 backdrop-blur-sm p-10 rounded-[2rem] border border-orange-100 space-y-6">
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-black uppercase tracking-tighter text-gray-900">Ajude-nos a melhorar</h3>
                                            <p className="text-gray-600 font-medium">Partilhe feedback sobre a simulação ou sugestões de funcionalidades.</p>
                                        </div>
                                        <Textarea
                                            value={feedbackMessage}
                                            onChange={(e) => setFeedbackMessage(e.target.value)}
                                            placeholder="Escreva aqui a sua mensagem..."
                                            rows={4}
                                            className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-orange-500 rounded-2xl p-5 text-lg font-bold"
                                        />
                                        <div className="flex justify-end">
                                            <Button onClick={handleSendFeedback} disabled={isSendingFeedback} className="bg-black text-white hover:bg-gray-900 px-8 h-12 font-black uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all active:scale-95">
                                                {isSendingFeedback ? <Loader2 className="animate-spin w-4 h-4" /> : 'Enviar Mensagem'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                <Battery className="absolute -right-20 -bottom-20 w-80 h-80 text-orange-500/10 rotate-12 pointer-events-none group-hover:scale-110 transition-transform duration-700" />
                            </section>
                        )}
                    </div>
                </div>
            </main >

            <Footer />

            <Dialog open={isPremiumModalOpen} onOpenChange={setIsPremiumModalOpen}>
                <DialogContent className="sm:max-w-md bg-white rounded-[2rem] border-none shadow-2xl overflow-hidden p-0">
                    <div className="h-2 bg-gradient-to-r from-orange-400 to-orange-600" />
                    <div className="p-10 space-y-8">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-4 text-3xl font-black text-gray-900 uppercase tracking-tighter">
                                <div className="p-3 bg-orange-100 rounded-2xl text-orange-600">
                                    <Sparkles className="w-8 h-8" />
                                </div>
                                Ups! Quase lá...
                            </DialogTitle>
                            <div className="pt-6 text-lg text-gray-600 leading-relaxed space-y-6 font-medium">
                                <p>
                                    Esta funcionalidade premium de <span className="text-gray-900 font-black">Relatórios Profissionais</span> ainda está em fase final de testes.
                                </p>
                                <p className="bg-orange-50 p-4 rounded-2xl border border-orange-100 text-orange-800 text-base font-bold">
                                    Registámos o seu interesse e a nossa equipa irá entrar em contacto assim que estiver disponível com uma oferta especial de lançamento!
                                </p>
                            </div>
                        </DialogHeader>
                        <div className="flex justify-center">
                            <Button
                                onClick={() => setIsPremiumModalOpen(false)}
                                className="bg-orange-600 hover:bg-orange-700 text-white px-12 h-14 text-xl font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-orange-100 transition-all active:scale-95 w-full"
                            >
                                Perfeito, obrigado!
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
