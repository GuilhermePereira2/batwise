import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getApiUrl } from '@/lib/config';
import { useAuth } from '@/context/AuthContext';
import {
    Battery, Home, FileText, Zap, Sun, Car,
    ChevronRight, ChevronLeft, Loader2,
    CheckCircle2, TrendingUp, Wallet, Plus, Trash2
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
        city: 'Lisboa',
        existing_inverter_brand: '',
        existing_inverter_model: '',
        existing_inverter_max_power_kw: 0,
        battery_ready_inverter: false,
        has_battery: false,
        battery_capacity_kwh: 0,
        existing_battery_brand: '',
        existing_battery_model: '',
        existing_battery_max_power_kw: 0
    },
    electric_vehicles: {
        has_electric_vehicle: false,
        count: 0,
        vehicles: []
    }
};

export default function Simulator() {
    const navigate = useNavigate();
    const { isAuthenticated, token } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<InputMode | null>(null);
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

    useEffect(() => {
        if (!isAuthenticated) return;
        const pending = localStorage.getItem('simulator_pending_auth');
        if (!pending) return;

        try {
            const parsed = JSON.parse(pending);
            if (parsed.formData) setFormData(parsed.formData);
            if (parsed.mode) setMode(parsed.mode);
            setStep(2);
        } catch {
            // Ignore invalid saved simulator state.
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
                    assumptions: { battery_dod: 0.9, system_losses: 0.1, component_margin: 0.1, installation_margin: 0.1 }
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
            setStep(3);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            console.error("Erro na simulação:", error);
            alert("Erro ao calcular. Verifica a conexão com o backend.");
        } finally {
            setLoading(false);
        }
    };

    const handleRequestQuote = (recommendation: any) => {
        const products = [];
        if (recommendation.battery) {
            products.push(`Bateria: ${recommendation.battery.quantity} x ${recommendation.battery.model}`);
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
        const body = `Olá, gostaria de solicitar um orçamento para a instalação dos seguintes produtos sugeridos pela simulação:\n\n${products.join('\n')}\n\nLocal da casa: ${formData.solar.city}, ${formData.house.area_m2} m²\n\nObrigado.`;
        const subject = 'Solicitação de Orçamento para instalação';
        localStorage.setItem('Message', body);
        localStorage.setItem('message', body);
        localStorage.setItem('subject', subject);
        window.location.href = '/contact';
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
        const installation = componentPrices.installation_margin ?? recommendation?.installation_margin_eur ?? hardwareTotal * 0.1;

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

                addText(`${index + 1}. ${getSystemName(rec)}`, margin, 11, 'bold', 5);
                addText(`Investimento estimado: ${formatPrice(rec.capex_total_eur)} | Hardware: ${formatPrice(prices.hardwareTotal)} | Instalação: ${formatPrice(prices.installation)}`, margin, 9);
                addText(`Fatura atual: ${formatPrice(rec.annual_bill_before_eur)}/ano | Após sistema: ${formatPrice(rec.annual_bill_after_eur)}/ano | Poupança: ${formatPrice(rec.savings_annual_eur)}/ano | Payback: ${rec.payback_years ? `${rec.payback_years} anos` : 'não aplicável'}`, margin, 9);
                addText(`Bateria: ${rec.battery.brand} ${rec.battery.model} (${rec.new_battery_capacity_kwh || rec.simulated_capacity_kwh} kWh)`, margin, 9);
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

        // =========================================================
        // --- ADICIONAR MARCA DE ÁGUA A TODAS AS PÁGINAS ---
        // =========================================================
        const totalPages = doc.internal.getNumberOfPages();

        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i); // Vai para a página 'i'

            doc.saveGraphicsState();
            doc.setGState(new (doc as any).GState({ opacity: 0.22 })); // Transparência (22%)
            doc.setFont("helvetica", "bold");
            doc.setFontSize(90); // Tamanho da letra
            doc.setTextColor(150, 150, 150); // Cor acinzentada

            // Calcular o centro exato da página
            const centerX = pageWidth / 3;
            const centerY = pageHeight / 3;

            // Desenhar o texto rodado a 45 graus no centro
            doc.text("Watt Builder", centerX, centerY, { align: "center", angle: 45 });

            doc.restoreGraphicsState(); // Restaura o estado para não afetar mais nada
        }
        // =========================================================

        doc.save(`propostas-wattbuilder-${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    const selectedPrices = selectedRecommendation ? getPriceBreakdown(selectedRecommendation) : null;

    return (
        <div className="flex flex-col min-h-screen bg-white text-black">
            <Navigation />

            <main className="flex-grow py-12">
                <div className="max-w-4xl mx-auto px-4">

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
                                                onClick={() => setFormData({
                                                    ...formData,
                                                    solar: {
                                                        ...formData.solar,
                                                        has_solar: false,
                                                        existing_inverter_brand: '',
                                                        existing_inverter_model: '',
                                                        existing_inverter_max_power_kw: 0,
                                                        battery_ready_inverter: false,
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
                                                <Label>O inversor dos painéis atuais suporta bateria?</Label>
                                                <div className="grid grid-cols-2 gap-2 max-w-sm">
                                                    <Button
                                                        className={`h-12 ${formData.solar.battery_ready_inverter ? 'bg-white border border-gray-200 text-black hover:bg-gray-100' : 'bg-orange-600 text-white hover:bg-orange-700'}`}
                                                        onClick={() => setFormData({ ...formData, solar: { ...formData.solar, battery_ready_inverter: false, has_battery: false, battery_capacity_kwh: 0, existing_battery_brand: '', existing_battery_model: '', existing_battery_max_power_kw: 0 } })}
                                                    >
                                                        Não
                                                    </Button>
                                                    <Button
                                                        className={`h-12 ${formData.solar.battery_ready_inverter ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border border-gray-200 text-black hover:bg-gray-100'}`}
                                                        onClick={() => setFormData({ ...formData, solar: { ...formData.solar, battery_ready_inverter: true } })}
                                                    >
                                                        Sim
                                                    </Button>
                                                </div>
                                                {!formData.solar.battery_ready_inverter && (
                                                    <p className="mt-2 text-sm font-medium text-red-700">
                                                        Atenção: ao escolher "Não", o inversor atual não será reaproveitado. Vai ficar fora do sistema de bateria e o orçamento passa a incluir um inversor novo compatível.
                                                    </p>
                                                )}
                                                {formData.solar.battery_ready_inverter && (
                                                    <div className="mt-3 space-y-3">
                                                        <p className="text-sm text-gray-500">
                                                            Vamos assumir que o inversor atual fica instalado e não será cobrado um inversor novo.
                                                        </p>
                                                        <div className="space-y-2">
                                                            <Label>Já tem bateria ligada a esse inversor?</Label>
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
                                                        </div>
                                                        {formData.solar.has_battery && (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold">Propostas recomendadas</h2>
                                    <p className="text-sm text-gray-500">Descarrega um PDF com todas as opções e métricas financeiras.</p>
                                </div>
                                <Button onClick={downloadProposalsPdf} className="bg-black text-white hover:bg-gray-800">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Descarregar PDF
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="mb-10 text-center">
                                    <h2 className="text-xl md:text-2xl font-semibold text-gray-800">
                                        {("Parâmetros ideais para a sua casa:")}
                                    </h2>
                                    <div className="mt-2 w-20 h-1 bg-black mx-auto rounded-full" />
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

                                {(results.summary?.annual_ev_consumption_estimated ?? 0) > 0 && (
                                    <Card className="border-gray-200 bg-white">
                                        <CardContent className="p-5">
                                            <p className="text-sm text-gray-500">Carros elétricos</p>
                                            <div className="mt-2 flex items-baseline gap-2">
                                                <span className="text-3xl font-extrabold text-black">{Math.round(results.summary?.annual_ev_consumption_estimated ?? 0)}</span>
                                                <span className="text-sm text-gray-500">kWh/ano</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            <div className="space-y-10">
                                {recommendationGroups.map((group) => (
                                    group.items.length > 0 && (
                                        <section key={group.tier} className="space-y-4">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <h2 className="text-2xl font-extrabold tracking-tight">{group.title}</h2>
                                                        <Badge variant="outline" className={group.badgeClass}>
                                                            {group.items.length} opções
                                                        </Badge>
                                                    </div>
                                                    <p className="mt-1 text-sm text-gray-500">{group.description}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                {group.items.map((rec: any, idx: number) => {
                                                    const prices = getPriceBreakdown(rec);

                                                    return (
                                                        <Card
                                                            key={`${group.tier}-${rec.battery?.id || idx}`}
                                                            onClick={() => setSelectedRecommendation(rec)}
                                                            className={`cursor-pointer relative overflow-hidden transition-all hover:scale-[1.02] bg-white ${idx === 0 ? 'border-orange-600 border-2 shadow-xl' : 'border-gray-200'}`}
                                                        >
                                                            {idx === 0 && (
                                                                <div className="absolute top-0 right-0 bg-orange-600 text-white px-3 py-1 text-xs font-bold rounded-bl-lg">
                                                                    TOP {group.title.toUpperCase()}
                                                                </div>
                                                            )}
                                                            <CardHeader className="pb-2">
                                                                <Badge className="w-fit mb-2 bg-black text-white hover:bg-black">Sistema completo</Badge>
                                                                <CardTitle className="text-xl">{getSystemName(rec)}</CardTitle>
                                                            </CardHeader>
                                                            <CardContent className="space-y-4">
                                                                <div className="flex items-baseline gap-1 border-b border-gray-100 pb-4">
                                                                    <span className="text-3xl font-extrabold">{rec.capex_total_eur.toLocaleString()}€</span>
                                                                    <span className="text-gray-400 text-sm">est.</span>
                                                                </div>

                                                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                                                                    <div className="flex justify-between gap-4">
                                                                        <span className="text-gray-500">Hardware</span>
                                                                        <span className="font-semibold">{formatPrice(prices.hardwareTotal)}</span>
                                                                    </div>
                                                                    <div className="mt-1 flex justify-between gap-4">
                                                                        <span className="text-gray-500">Instalação</span>
                                                                        <span className="font-semibold">{formatPrice(prices.installation)}</span>
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-3">
                                                                    <div className="rounded-lg border border-gray-200 p-3">
                                                                        <div className="flex items-start gap-3">
                                                                            <Battery className="w-5 h-5 mt-0.5 text-orange-600" />
                                                                            <div>
                                                                                <p className="text-xs uppercase text-gray-400 font-semibold">Bateria</p>
                                                                                <p className="text-base font-bold leading-tight">{rec.battery.brand} {rec.battery.model}</p>
                                                                                <p className="text-xs text-gray-500">{rec.new_battery_capacity_kwh || rec.simulated_capacity_kwh} kWh novos</p>
                                                                                {rec.existing_battery?.has_battery && (
                                                                                    <p className="text-xs text-gray-500">
                                                                                        + {rec.existing_battery.capacity_kwh} kWh existentes = {rec.simulated_capacity_kwh} kWh simulados
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {rec.inverter && (
                                                                        <div className="rounded-lg border border-gray-200 p-3">
                                                                            <div className="flex items-start gap-3">
                                                                                <Zap className="w-5 h-5 mt-0.5 text-orange-600" />
                                                                                <div>
                                                                                    <p className="text-xs uppercase text-gray-400 font-semibold">Inversor</p>
                                                                                    <p className="text-base font-bold leading-tight">{rec.inverter.brand} {rec.inverter.model}</p>
                                                                                    <p className="text-xs text-gray-500">{rec.inverter.specs?.power_kw} kW</p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {rec.existing_inverter_action === 'replace' && rec.replacement_notes?.length > 0 && (
                                                                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                                                                            {rec.replacement_notes[0]}
                                                                        </div>
                                                                    )}
                                                                    {rec.solar_panels && (
                                                                        <div className="rounded-lg border border-gray-200 p-3">
                                                                            <div className="flex items-start gap-3">
                                                                                <Sun className="w-5 h-5 mt-0.5 text-orange-600" />
                                                                                <div>
                                                                                    <p className="text-xs uppercase text-gray-400 font-semibold">Painéis solares</p>
                                                                                    <p className="text-base font-bold leading-tight">
                                                                                        {rec.solar_panels.expanded
                                                                                            ? `Existentes + ${rec.solar_panels.quantity} x ${rec.solar_panels.panel.brand} ${rec.solar_panels.panel.model}`
                                                                                            : rec.solar_panels.existing
                                                                                                ? 'Painéis existentes'
                                                                                                : `${rec.solar_panels.quantity} x ${rec.solar_panels.panel.brand} ${rec.solar_panels.panel.model}`}
                                                                                    </p>
                                                                                    <p className="text-xs text-gray-500">{rec.solar_panels.array_power_kwp} kWp</p>
                                                                                    {rec.solar_panels.expanded && (
                                                                                        <p className="text-xs text-gray-500">
                                                                                            {rec.solar_panels.existing_power_kwp} kWp existentes + {rec.solar_panels.added_power_kwp} kWp novos
                                                                                        </p>
                                                                                    )}
                                                                                    {rec.solar_panels.roof_area_m2 && (
                                                                                        <p className="text-xs text-gray-500">
                                                                                            {rec.solar_panels.total_panel_area_m2} m² de {rec.solar_panels.roof_area_m2} m² ({rec.solar_panels.roof_coverage_pct}%)
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="space-y-3 pt-2">
                                                                    <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                                                                        <div>
                                                                            <p className="text-xs text-gray-500">Fatura atual</p>
                                                                            <p className="font-bold">{formatPrice(rec.annual_bill_before_eur)}/ano</p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs text-gray-500">Após sistema</p>
                                                                            <p className="font-bold">{formatPrice(rec.annual_bill_after_eur)}/ano</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center text-sm text-black">
                                                                        <TrendingUp className="w-4 h-4 mr-2 text-orange-600" />
                                                                        <span>Poupança anual: <strong>{formatPrice(rec.savings_annual_eur)}/ano</strong></span>
                                                                    </div>
                                                                    <div className="flex items-center text-sm text-black">
                                                                        <Wallet className="w-4 h-4 mr-2 text-orange-600" />
                                                                        <span>Payback: <strong>{rec.payback_years ? `${rec.payback_years} anos` : 'não aplicável'}</strong></span>
                                                                    </div>
                                                                    <p className="text-xs text-gray-500">
                                                                        Hardware: {formatPrice(prices.hardwareTotal)} + instalação: {formatPrice(prices.installation)}.
                                                                    </p>
                                                                </div>

                                                                <Button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRequestQuote(rec);
                                                                    }}
                                                                    className={`w-full mt-4 ${idx === 0 ? 'bg-black text-white hover:bg-gray-800' : 'bg-white border-2 border-black text-black hover:bg-gray-50'}`}
                                                                >
                                                                    Solicitar Orçamento
                                                                </Button>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    )
                                ))}
                            </div>

                            {selectedRecommendation && (
                                <div
                                    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-6 overflow-y-auto"
                                    onClick={() => setSelectedRecommendation(null)}
                                >
                                    <div className="relative w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-200">
                                            <div>
                                                <p className="text-sm text-gray-500">Detalhes da recomendação</p>
                                                <h2 className="text-2xl font-bold">{getSystemName(selectedRecommendation)}</h2>
                                                <p className="text-sm text-gray-500 mt-1">Capacidade simulada: {selectedRecommendation.simulated_capacity_kwh} kWh úteis</p>
                                            </div>
                                            <Button variant="ghost" onClick={() => setSelectedRecommendation(null)} className="text-gray-500 hover:text-black">
                                                <ChevronLeft className="w-6 h-6" />
                                            </Button>
                                        </div>

                                        <div className="p-6 space-y-6">
                                            <div className="grid gap-6 lg:grid-cols-3">
                                                <div className="rounded-3xl border border-gray-200 p-5 bg-gray-50">
                                                    <p className="text-xs uppercase text-gray-400 font-semibold mb-2">Investimento estimado</p>
                                                    <p className="text-3xl font-bold">{selectedRecommendation.capex_total_eur.toLocaleString()}€</p>
                                                    <p className="text-sm text-gray-500 mt-1">inclui hardware e instalação</p>
                                                </div>
                                                <div className="rounded-3xl border border-gray-200 p-5 bg-gray-50">
                                                    <p className="text-xs uppercase text-gray-400 font-semibold mb-2">Fatura anual</p>
                                                    <p className="text-3xl font-bold">{formatPrice(selectedRecommendation.annual_bill_after_eur)}</p>
                                                    <p className="text-sm text-gray-500 mt-1">antes: {formatPrice(selectedRecommendation.annual_bill_before_eur)}/ano</p>
                                                </div>
                                                <div className="rounded-3xl border border-gray-200 p-5 bg-gray-50">
                                                    <p className="text-xs uppercase text-gray-400 font-semibold mb-2">Payback</p>
                                                    <p className="text-3xl font-bold">{selectedRecommendation.payback_years ? `${selectedRecommendation.payback_years} anos` : 'não aplicável'}</p>
                                                    <p className="text-sm text-gray-500 mt-1">poupança: {formatPrice(selectedRecommendation.savings_annual_eur)}/ano</p>
                                                </div>
                                            </div>

                                            <div className="grid gap-6 lg:grid-cols-2">
                                                <div className="rounded-3xl border border-gray-200 p-6">
                                                    <h3 className="text-lg font-bold mb-4">Bateria</h3>
                                                    <p className="text-sm text-gray-500 mb-2">{selectedRecommendation.battery.brand} {selectedRecommendation.battery.model}</p>
                                                    <div className="space-y-2 text-sm">
                                                        <p><span className="font-semibold">Capacidade nova:</span> {selectedRecommendation.new_battery_capacity_kwh || selectedRecommendation.simulated_capacity_kwh} kWh</p>
                                                        {selectedRecommendation.existing_battery?.has_battery && (
                                                            <>
                                                                <p><span className="font-semibold">Bateria existente:</span> {getExistingBatteryDescription(selectedRecommendation.existing_battery)}</p>
                                                                <p><span className="font-semibold">Capacidade total simulada:</span> {selectedRecommendation.simulated_capacity_kwh} kWh</p>
                                                            </>
                                                        )}
                                                        <p><span className="font-semibold">Tensão:</span> {selectedRecommendation.battery.specs?.voltage || 'N/A'}</p>
                                                        <p><span className="font-semibold">Ciclos estimados:</span> {selectedRecommendation.battery.specs?.cycles || 'N/A'}</p>
                                                    </div>
                                                </div>

                                                {selectedRecommendation.inverter && (
                                                    <div className="rounded-3xl border border-gray-200 p-6">
                                                        <h3 className="text-lg font-bold mb-4">Inversor</h3>
                                                        <p className="text-sm text-gray-500 mb-2">{selectedRecommendation.inverter.brand} {selectedRecommendation.inverter.model}</p>
                                                        <div className="space-y-2 text-sm">
                                                            <p><span className="font-semibold">Potência:</span> {selectedRecommendation.inverter.specs?.power_kw || 'N/A'} kW</p>
                                                            <p><span className="font-semibold">Eficiência:</span> {selectedRecommendation.inverter.specs?.efficiency || 'N/A'}</p>
                                                            <p><span className="font-semibold">Tipo:</span> {selectedRecommendation.inverter.specs?.type || 'N/A'}</p>
                                                        </div>
                                                        {selectedRecommendation.existing_inverter_action === 'replace' && selectedRecommendation.replacement_notes?.length > 0 && (
                                                            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                                                                {selectedRecommendation.replacement_notes.map((note: string) => (
                                                                    <p key={note}>{note}</p>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {selectedRecommendation.solar_panels && (
                                                <div className="rounded-3xl border border-gray-200 p-6">
                                                    <h3 className="text-lg font-bold mb-4">Painéis solares</h3>
                                                    <p className="text-sm text-gray-500 mb-2">
                                                        {selectedRecommendation.solar_panels.expanded
                                                            ? `Painéis existentes + ${selectedRecommendation.solar_panels.quantity} x ${selectedRecommendation.solar_panels.panel.brand} ${selectedRecommendation.solar_panels.panel.model}`
                                                            : selectedRecommendation.solar_panels.existing
                                                                ? 'Painéis solares existentes'
                                                                : `${selectedRecommendation.solar_panels.quantity} x ${selectedRecommendation.solar_panels.panel.brand} ${selectedRecommendation.solar_panels.panel.model}`}
                                                    </p>
                                                    <div className="space-y-2 text-sm">
                                                        <p><span className="font-semibold">Potência total:</span> {selectedRecommendation.solar_panels.array_power_kwp} kWp</p>
                                                        {selectedRecommendation.solar_panels.expanded && (
                                                            <>
                                                                <p><span className="font-semibold">Potência existente:</span> {selectedRecommendation.solar_panels.existing_power_kwp} kWp</p>
                                                                <p><span className="font-semibold">Potência nova:</span> {selectedRecommendation.solar_panels.added_power_kwp} kWp</p>
                                                            </>
                                                        )}
                                                        {selectedRecommendation.solar_panels.roof_area_m2 && (
                                                            <>
                                                                <p><span className="font-semibold">Área estimada do telhado:</span> {selectedRecommendation.solar_panels.roof_area_m2} m²</p>
                                                                <p><span className="font-semibold">Área ocupada por painéis:</span> {selectedRecommendation.solar_panels.total_panel_area_m2} m²</p>
                                                                <p><span className="font-semibold">Ocupação do telhado:</span> {selectedRecommendation.solar_panels.roof_coverage_pct}%</p>
                                                            </>
                                                        )}
                                                        {(!selectedRecommendation.solar_panels.existing || selectedRecommendation.solar_panels.expanded) && (
                                                            <>
                                                                <p><span className="font-semibold">Potência por painel novo:</span> {selectedRecommendation.solar_panels.panel.specs?.power_w || 'N/A'} W</p>
                                                                <p><span className="font-semibold">Área dos painéis novos:</span> {selectedRecommendation.solar_panels.additional_panel_set?.total_panel_area_m2 || selectedRecommendation.solar_panels.total_panel_area_m2} m²</p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {selectedPrices && (
                                                <div className="rounded-3xl border border-gray-200 p-6 bg-gray-50">
                                                    <h3 className="text-lg font-bold mb-4">Resumo do investimento</h3>
                                                    <div className="space-y-3 text-sm text-gray-700">
                                                        <div className="flex justify-between gap-4">
                                                            <span>Total hardware</span>
                                                            <span className="font-semibold text-black">{formatPrice(selectedPrices.hardwareTotal)}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4">
                                                            <span>Instalação</span>
                                                            <span className="font-semibold text-black">{formatPrice(selectedPrices.installation)}</span>
                                                        </div>
                                                        <div className="border-t border-gray-300 pt-3 flex justify-between gap-4 text-base">
                                                            <span className="font-bold text-black">Total estimado</span>
                                                            <span className="font-extrabold text-black">{formatPrice(selectedRecommendation.capex_total_eur)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex flex-col gap-3 sm:flex-row">
                                                <Button className="flex-1 bg-white border-2 border-black text-black hover:bg-gray-50" onClick={() => setSelectedRecommendation(null)}>
                                                    Fechar Detalhes
                                                </Button>
                                                <Button className="flex-1 bg-black text-white hover:bg-gray-800" onClick={(e) => {
                                                    e.stopPropagation();
                                                    const products = [];
                                                    if (selectedRecommendation.battery) {
                                                        products.push(`Bateria: ${selectedRecommendation.battery.quantity} x ${selectedRecommendation.battery.model}`);
                                                    }
                                                    if (selectedRecommendation.existing_battery?.has_battery) {
                                                        products.push(`Bateria existente considerada: ${getExistingBatteryDescription(selectedRecommendation.existing_battery)}`);
                                                    }
                                                    if (selectedRecommendation.inverter) {
                                                        products.push(`Inversor: ${selectedRecommendation.inverter.brand} ${selectedRecommendation.inverter.model}`);
                                                    }
                                                    if (selectedRecommendation.solar_panels) {
                                                        if (selectedRecommendation.solar_panels.expanded) {
                                                            products.push(`Painéis solares existentes: ${selectedRecommendation.solar_panels.existing_power_kwp} kWp`);
                                                            products.push(`Reforço solar: ${selectedRecommendation.solar_panels.quantity} x ${selectedRecommendation.solar_panels.panel.brand} ${selectedRecommendation.solar_panels.panel.model} (${selectedRecommendation.solar_panels.added_power_kwp} kWp adicionais)`);
                                                        } else if (selectedRecommendation.solar_panels.existing) {
                                                            products.push(`Painéis solares existentes: ${selectedRecommendation.solar_panels.array_power_kwp} kWp`);
                                                        } else {
                                                            products.push(`Painéis solares: ${selectedRecommendation.solar_panels.quantity} x ${selectedRecommendation.solar_panels.panel.brand} ${selectedRecommendation.solar_panels.panel.model}`);
                                                        }
                                                    }
                                                    if (selectedRecommendation.replacement_notes?.length) {
                                                        products.push(...selectedRecommendation.replacement_notes.map((note: string) => `Nota: ${note}`));
                                                    }
                                                    const body = `Olá, gostaria de solicitar um orçamento para a instalação dos seguintes produtos sugeridos pela simulação:\n\n${products.join('\n')}\n\nLocal da casa: ${formData.solar.city}, ${formData.house.area_m2} m²\n\nObrigado.`;
                                                    localStorage.setItem('Message', body);
                                                    window.location.href = '/contact';
                                                }}>
                                                    Solicitar Orçamento
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
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
                                <Button variant="link" onClick={() => setStep(1)} className="text-gray-500 hover:text-black">Refazer Simulação</Button>
                            </div>
                        </div>
                    )}

                    {/* Waiting List Section */}
                    <section className="mt-24 p-10 bg-orange-50 rounded-3xl text-black relative overflow-hidden">
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
