import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getApiUrl } from '@/lib/config';
import { useAuth } from '@/context/AuthContext';
import RecommendationModal from '@/components/RecommendationModal';
import {
    Battery, Home, FileText, Zap, Sun, Car,
    ChevronRight, ChevronLeft, Loader2,
    CheckCircle2, TrendingUp, Wallet, Plus, Trash2
} from 'lucide-react';

type InputMode = 'house' | 'bill';

const parseStepParam = (value: string | null) => {
    if (value === 'input') return 2;
    if (value === 'results') return 3;
    return 1;
};

const parseModeParam = (value: string | null): InputMode | null => {
    return value === 'house' || value === 'bill' ? value : null;
};

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
        city: 'Lisboa',
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
    const { isAuthenticated, token } = useAuth();
    const [step, setStep] = useState(() => parseStepParam(searchParams.get('step')));
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<InputMode | null>(() => parseModeParam(searchParams.get('mode')));
    const [results, setResults] = useState<any>(null);
    const [selectedRecommendation, setSelectedRecommendation] = useState<any>(null);
    const [reportEmail, setReportEmail] = useState('');
    const [isSendingReportEmail, setIsSendingReportEmail] = useState(false);

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
                    subject: 'Relatório Tecnico Completo',
                    message: reportEmail.trim(),
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
                solar: { ...DEFAULT_STATE.solar, ...(parsed.solar || {}) },
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

    const getActiveTariffPrices = (tariff: any) => {
        const prices = tariff?.prices || {};
        if (tariff?.type === 'bi') {
            return {
                offPeak: Number(prices.offPeak ?? 0),
                peak: Number(prices.peak ?? 0),
            };
        }
        if (tariff?.type === 'tri') {
            return {
                offPeak: Number(prices.offPeak ?? 0),
                peak: Number(prices.peak ?? 0),
                ponta: Number(prices.ponta ?? 0),
            };
        }
        return {
            simple: Number(prices.simple ?? 0),
        };
    };

    const runSimulation = async () => {
        if (!isAuthenticated || !token) {
            localStorage.setItem('simulator_pending_auth', JSON.stringify({ step, mode, formData }));
            navigate('/login?redirect=/simulator');
            return;
        }

        setLoading(true);
        try {
            const tariffPayload = {
                type: formData.tariff.type,
                prices: getActiveTariffPrices(formData.tariff),
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
                        },
                        electric_vehicles: formData.electric_vehicles,
                    },
                    tariff: tariffPayload,
                    solar: formData.solar,
                    max_investment: formData.max_investment ? Number(formData.max_investment) : null,
                    assumptions: { battery_dod: 0.9, system_losses: 0.1, component_margin: 0.1, installation_margin: 0.25 }
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
            description: 'Equilíbrio entre custo, capacidade e retorno.',
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

    const downloadProposalsPdf = () => {
        if (!results?.recommendations?.length) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 14;
        const maxWidth = pageWidth - margin * 2;
        let y = 18;

        const addPageIfNeeded = (height = 18) => {
            if (y + height <= pageHeight - margin) return;
            doc.addPage();
            y = 18;
        };

        const addText = (text: string, x = margin, fontSize = 10, style: 'normal' | 'bold' = 'normal', lineGap = 5) => {
            doc.setFont('helvetica', style);
            doc.setFontSize(fontSize);
            const lines = doc.splitTextToSize(text, maxWidth - (x - margin));
            addPageIfNeeded(lines.length * lineGap + 2);
            doc.text(lines, x, y);
            y += lines.length * lineGap;
        };

        doc.setTextColor(0, 0, 0);
        addText('WattBuilder - Propostas da Simulação', margin, 18, 'bold', 8);
        addText(`Data: ${new Date().toLocaleDateString('pt-PT')}`, margin, 10);
        addText(`Consumo anual estimado: ${Math.round(results.summary?.annual_consumption_estimated ?? 0).toLocaleString()} kWh`, margin, 10);
        addText(`Produção solar estimada: ${Math.round(results.summary?.annual_solar_estimated ?? 0).toLocaleString()} kWh/ano`, margin, 10);
        if ((results.summary?.annual_ev_consumption_estimated ?? 0) > 0) {
            addText(`Consumo de carros elétricos: ${Math.round(results.summary.annual_ev_consumption_estimated).toLocaleString()} kWh/ano`, margin, 10);
        }
        y += 4;

        budgetSections.forEach((section) => {
            const items = (results.recommendations || []).filter((rec: any) => rec.budget_tier === section.tier);
            if (!items.length) return;

            addPageIfNeeded(20);
            addText(section.title, margin, 14, 'bold', 7);
            addText(section.description, margin, 9);
            y += 2;

            items.forEach((rec: any, index: number) => {
                const prices = getPriceBreakdown(rec);
                addPageIfNeeded(58);
                doc.setDrawColor(220, 220, 220);
                doc.line(margin, y, pageWidth - margin, y);
                y += 6;

                addText(`Solução ${index + 1}: ${getSystemName(rec)}`, margin, 11, 'bold', 5);
                addText(`Investimento estimado: ${formatPrice(rec.capex_total_eur)} | Hardware: ${formatPrice(prices.hardwareTotal)} | Instalação: ${formatPrice(prices.installation)}`, margin, 9);
                addText(`Fatura atual: ${formatPrice(rec.annual_bill_before_eur)}/ano | Após sistema: ${formatPrice(rec.annual_bill_after_eur)}/ano | Poupança: ${formatPrice(rec.savings_annual_eur)}/ano | Payback: ${rec.payback_years ? `${rec.payback_years} anos` : 'não aplicável'}`, margin, 9);
                addText(`Bateria: ${getBatteryDescription(rec)} (${rec.new_battery_capacity_kwh || rec.simulated_capacity_kwh} kWh)`, margin, 9);
                if (rec.existing_battery?.has_battery) {
                    addText(`Bateria existente: ${getExistingBatteryDescription(rec.existing_battery)}`, margin, 9);
                }
                if (rec.inverter) {
                    addText(`Inversor: ${rec.inverter.brand} ${rec.inverter.model} (${rec.inverter.specs?.power_kw || 'N/A'} kW)`, margin, 9);
                }
                addText(`Painéis solares: ${getSolarDescription(rec.solar_panels)}`, margin, 9);
                if (rec.replacement_notes?.length) {
                    rec.replacement_notes.forEach((note: string) => addText(`Nota: ${note}`, margin, 8));
                }
                y += 4;
            });
        });

        addPageIfNeeded(28);
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;
        addText('Notas', margin, 12, 'bold');
        (results.notes || []).forEach((note: string) => addText(`- ${note}`, margin, 8));

        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.saveGraphicsState();
            doc.setGState(new (doc as any).GState({ opacity: 0.22 }));
            doc.setFont("helvetica", "bold");
            doc.setFontSize(100);
            doc.setTextColor(150, 150, 150);

            const centerX = pageWidth / 2;
            const centerY = pageHeight / 2;

            doc.text("Watt Builder", centerX + 50, centerY + 70, { align: "center", angle: 45 });
            doc.restoreGraphicsState();
        }

        doc.save(`propostas-wattbuilder-${new Date().toISOString().slice(0, 10)}.pdf`);
    };

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
                                    <p className="text-gray-500 text-sm">Não tenho a fatura comigo, quero estimar pelo número de pessoas e características da casa.</p>
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
                        <Card className="shadow-xl border-gray-200 animate-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
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
                                                    onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, peak_kw: Number(e.target.value) } })}
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
                                                    onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, existing_inverter_max_power_kw: Number(e.target.value) } })}
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
                                                                onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, battery_capacity_kwh: Number(e.target.value) } })}
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
                                                                onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, existing_battery_max_power_kw: Number(e.target.value) } })}
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
                                                            <Label>Modelo da bateria atual</Label>
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
                                                                    onChange={(e) => updateElectricVehicle(index, 'daily_km', Number(e.target.value))}
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
                                                                    onChange={(e) => updateElectricVehicle(index, 'consumption_kwh_per_km', Number(e.target.value))}
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

                                <div className="pt-4 border-t border-gray-200">
                                    <Label>Qual o valor máximo de investimento que pretende? (Opcional)</Label>
                                    <div className="mt-2 relative max-w-sm">
                                        <Input
                                            type="number"
                                            min="0"
                                            placeholder="Ex: 5000"
                                            className="border-gray-300 focus-visible:ring-orange-600 pr-8"
                                            value={formData.max_investment}
                                            onChange={(e) => setFormData({ ...formData, max_investment: e.target.value })}
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
                                <Button onClick={downloadProposalsPdf} className="bg-black text-white hover:bg-gray-800">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Descarregar PDF
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="mb-6 md:mb-0 text-center md:text-left flex flex-col justify-center">
                                    <h2 className="text-xl md:text-2xl font-semibold text-gray-800">
                                        Parâmetros ideais para a sua casa:
                                    </h2>
                                    <div className="mt-2 w-12 h-1 bg-black rounded-full mx-auto md:mx-0" />
                                </div>
                                <Card className="border-gray-200 bg-white">
                                    <CardContent className="p-5">
                                        <p className="text-sm text-gray-500">Capacidade ideal</p>
                                        <div className="mt-2 flex items-baseline gap-2">
                                            <span className="text-3xl font-extrabold text-black">{results.summary?.ideal_capacity_kwh ?? 0}</span>
                                            <span className="text-sm text-gray-500">kWh</span>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-gray-200 bg-white">
                                    <CardContent className="p-5">
                                        <p className="text-sm text-gray-500">Poupança estimada</p>
                                        <div className="mt-2 flex items-baseline gap-2">
                                            <span className="text-3xl font-extrabold text-black">{Math.round(results.summary?.savings_annual_eur ?? 0)}</span>
                                            <span className="text-sm text-gray-500">€/ano</span>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-gray-200 bg-white">
                                    <CardContent className="p-5">
                                        <p className="text-sm text-gray-500">Consumo anual</p>
                                        <div className="mt-2 flex items-baseline gap-2">
                                            <span className="text-3xl font-extrabold text-black">{Math.round(results.summary?.annual_consumption_estimated ?? 0)}</span>
                                            <span className="text-sm text-gray-500">kWh</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

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
                                                            className={`cursor-pointer relative overflow-hidden transition-all hover:scale-[1.02] bg-white flex flex-col h-full ${idx === 0 ? 'border-orange-600 border-2 shadow-md' : 'border-gray-200 shadow-sm'}`}
                                                        >
                                                            {idx === 0 && (
                                                                <div className="absolute top-0 right-0 bg-orange-600 text-white px-2 py-0.5 text-[10px] font-bold rounded-bl-lg">
                                                                    TOP {group.title.toUpperCase()}
                                                                </div>
                                                            )}

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
                                                                        className={`w-full ${idx === 0 ? 'bg-black text-white hover:bg-gray-800' : 'bg-white border border-gray-300 text-black hover:bg-gray-50'}`}
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
                        </div>
                        <Battery className="absolute -right-10 -bottom-10 w-64 h-64 text-orange-200/20 rotate-12" />
                    </section>

                </div>
            </main>

            <Footer />
        </div>
    );
}
