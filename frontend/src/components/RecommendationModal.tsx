import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Battery, Zap, Sun, Info } from 'lucide-react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Table,
    TableBody,
    TableCell,
    TableRow,
} from "@/components/ui/table";

interface RecommendationModalProps {
    recommendation: any;
    onClose: () => void;
    onRequestQuote: (rec: any) => void;
    formatPrice: (value: any) => string;
    getSystemName: (rec: any) => string;
    getExistingBatteryDescription: (bat: any) => string;
    getPriceBreakdown: (rec: any) => { hardwareTotal: number; installation: number };
}

export default function RecommendationModal({
    recommendation,
    onClose,
    onRequestQuote,
    formatPrice,
    getSystemName,
    getExistingBatteryDescription,
    getPriceBreakdown,
}: RecommendationModalProps) {
    const accordionRef = useRef<HTMLDivElement>(null);
    const [openItem, setOpenItem] = useState<string | undefined>(undefined);

    if (!recommendation) return null;

    const prices = getPriceBreakdown(recommendation);
    const batteryQuantity = Number(recommendation.battery?.quantity || 1);
    const batteryPrefix = batteryQuantity > 1 ? `${batteryQuantity} x ` : '';
    const batteryDescription = `${batteryPrefix}${recommendation.battery?.brand || ''} ${recommendation.battery?.model || ''}`.trim();
    const componentPrices = recommendation.component_prices_eur || {};
    const priceRows = [
        {
            label: 'Bateria',
            value: componentPrices.battery ?? recommendation.battery?.pricing?.unit_price ?? 0,
        },
        {
            label: 'Inversor',
            value: componentPrices.inverter ?? recommendation.inverter?.pricing?.unit_price ?? 0,
        },
        {
            label: 'Painéis solares',
            value: componentPrices.solar_panels ?? recommendation.solar_panels?.total_price_eur ?? 0,
        },
    ];

    const scrollToSpecs = (item: string) => {
        setOpenItem(item);
        setTimeout(() => {
            accordionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    const renderSpecTable = (data: any, componentType: 'battery' | 'inverter' | 'panels') => {
        if (!data) return null;

        const formatValue = (key: string, val: any) => {
            if (val === null || val === undefined || val === '') return 'N/A';
            if (typeof val === 'boolean') return val ? 'Sim' : 'Não';

            // Formatação de strings específicas (remover underscores e capitalizar)
            if (key === 'battery_type' || key === 'battery_technology' || key === 'grid_type') {
                return val.toString().replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
            }

            if (typeof val === 'object') {
                if (key === 'dimensions_mm' || key === 'size_mm') {
                    return `${val.width || val.length || '?'} x ${val.height || '?'} x ${val.depth || val.thickness || '?'} mm`;
                }
                if (key === 'operating_temperature_c') {
                    return `${val.min}°C a ${val.max}°C`;
                }
                if (key === 'pv_voltage_range_v' || key === 'battery_voltage_range_v') {
                    return `${val.min}V - ${val.max}V`;
                }
                return JSON.stringify(val);
            }
            if (key.includes('capacity_kwh') || key.includes('energy_kwh')) return `${val} kWh`;
            if (key.includes('power_kw')) return `${val} kW`;
            if (key.includes('voltage') && typeof val === 'number') return `${val}V`;
            if (key.includes('weight_kg')) return `${val} kg`;
            if (key.includes('pct') || key.includes('ratio') || key.includes('efficiency')) {
                const num = parseFloat(val);
                return isNaN(num) ? val : num <= 1 ? `${(num * 100).toFixed(1)}%` : `${num}%`;
            }
            if (key === 'warranty_years') return `${val} anos`;
            return val.toString();
        };

        const labels: Record<string, string> = {
            'capacity_kwh': 'Capacidade Nominal',
            'usable_capacity_kwh': 'Capacidade Útil',
            'power_kw': 'Potência',
            'dod': 'Profundidade de Descarga (DoD)',
            'chemistry': 'Química',
            'battery_type': 'Tipo de Bateria',
            'nominal_voltage_class': 'Classe de Tensão',
            'voltage': 'Tensão',
            'cycles': 'Ciclos Estimados',
            'dimensions_mm': 'Dimensões (LxAxP)',
            'size_mm': 'Dimensões (LxAxP)',
            'weight_kg': 'Peso',
            'operating_temperature_c': 'Temperatura de Operação',
            'warranty_years': 'Garantia',
            'max_pv_input_kwp': 'Potência Max Solar',
            'pv_voltage_range_v': 'Gama de Tensão PV',
            'max_battery_charge_discharge_kw': 'Carga/Descarga Max Bateria',
            'battery_technology': 'Tecnologia de Bateria',
            'grid_type': 'Ligação à rede',
            'phases': 'Fases',
            'is_hybrid': 'Híbrido',
            'connection': 'Conexão',
            'max_efficiency': 'Eficiência Máxima',
            'efficiency_pct': 'Eficiência',
            'power_w': 'Potência Unitária',
            'technology': 'Tecnologia',
            'type': 'Tipo de Célula',
        };

        // Filtragem personalizada de campos com base no tipo de componente
        const excludedKeys = ['id', 'ids', 'url', 'links', 'size_mm'];

        if (componentType === 'battery') {
            excludedKeys.push('nominal_voltage_class', 'max_series_connection', 'max_parallel_connection');
        } else if (componentType === 'inverter') {
            excludedKeys.push('connection', 'battery_type', 'phases');
        }

        const specs = Object.entries(data)
            .filter(([key]) => !excludedKeys.some(ex => key === ex || key.includes('id') && key !== 'grid_type'))
            .map(([key, val]) => ({
                label: labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                value: formatValue(key, val)
            }));

        return (
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableBody>
                        {specs.map((spec, i) => (
                            <TableRow key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <TableCell className="font-medium text-gray-600 py-2 w-1/2">{spec.label}</TableCell>
                                <TableCell className="text-gray-900 py-2">{spec.value}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    };

    return (
        <Dialog open={!!recommendation} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-white p-0">
                <DialogHeader className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <DialogDescription className="text-sm text-gray-500 uppercase tracking-wider font-semibold text-left">Detalhes da recomendação</DialogDescription>
                    <DialogTitle className="text-2xl font-bold mt-1 text-left">{getSystemName(recommendation)}</DialogTitle>
                    <p className="text-sm text-gray-500 mt-1 text-left">
                        Capacidade simulada: <span className="font-semibold text-gray-700">{recommendation.simulated_capacity_kwh} kWh úteis</span>
                    </p>
                </DialogHeader>

                <div className="p-6 space-y-8">
                    {/* Top Highlights */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-gray-200 p-5 bg-gray-50 flex flex-col justify-center text-center md:text-left">
                            <p className="text-xs uppercase text-gray-500 font-semibold mb-1">Preço Hardware</p>
                            <p className="text-3xl font-bold text-orange-600">{formatPrice(recommendation.capex_total_eur)}</p>
                            <p className="text-xs text-gray-500 mt-1">estimativa de componentes</p>
                        </div>
                        <div className="rounded-2xl border border-gray-200 p-5 bg-gray-50 flex flex-col justify-center text-center md:text-left">
                            <p className="text-xs uppercase text-gray-500 font-semibold mb-1">Fatura anual</p>
                            <div className="flex items-end justify-center md:justify-start gap-2">
                                <p className="text-3xl font-bold text-gray-900">{formatPrice(recommendation.annual_bill_after_eur)}</p>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 line-through">antes: {formatPrice(recommendation.annual_bill_before_eur)}/ano</p>
                        </div>
                        <div className="rounded-2xl border border-gray-200 p-5 bg-emerald-50 border-emerald-100 flex flex-col justify-center text-center md:text-left">
                            <p className="text-xs uppercase text-emerald-700 font-semibold mb-1">Retorno (Hardware)</p>
                            <p className="text-3xl font-bold text-emerald-700">
                                {recommendation.payback_years ? `${recommendation.payback_years} anos` : 'N/A'}
                            </p>
                            <p className="text-xs text-emerald-600 mt-1 font-medium">
                                poupança: {formatPrice(recommendation.savings_annual_eur)}/ano
                            </p>
                        </div>
                    </div>

                    {/* Hardware Details (Summaries) */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Battery Specs */}
                        <div className="rounded-2xl border border-gray-200 p-6 flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-orange-100 rounded-lg"><Battery className="w-5 h-5 text-orange-600" /></div>
                                    <h3 className="text-lg font-bold">Bateria</h3>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <button
                                        onClick={() => scrollToSpecs('battery')}
                                        className="text-xs text-orange-600 font-semibold hover:underline flex items-center gap-1"
                                    >
                                        <Info className="w-3 h-3" /> Ver especificações
                                    </button>
                                    {recommendation.battery?.links?.url && (
                                        <a href={recommendation.battery.links.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 hover:text-orange-600 hover:underline">
                                            Ver no Marketplace →
                                        </a>
                                    )}
                                </div>
                            </div>
                            <p className="text-base font-semibold text-gray-900 mb-4">{batteryDescription}</p>

                            <div className="space-y-3 text-sm flex-1">
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
                                    <p className="flex justify-between"><span className="text-gray-500">Capacidade nova:</span> <span className="font-semibold">{recommendation.new_battery_capacity_kwh || recommendation.simulated_capacity_kwh} kWh</span></p>
                                    {recommendation.existing_battery?.has_battery && (
                                        <>
                                            <p className="flex justify-between"><span className="text-gray-500">Bateria existente:</span> <span className="font-semibold text-right max-w-[200px] truncate">{getExistingBatteryDescription(recommendation.existing_battery)}</span></p>
                                            <div className="border-t border-gray-200 my-1 pt-1">
                                                <p className="flex justify-between"><span className="text-gray-500">Capacidade total:</span> <span className="font-bold">{recommendation.simulated_capacity_kwh} kWh</span></p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-y-2 gap-x-4 pt-2">
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="text-gray-500">Potência:</span>
                                        <span className="font-medium">{recommendation.battery?.specs?.power_kw ? `${recommendation.battery.specs.power_kw} kW` : 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="text-gray-500">Garantia:</span>
                                        <span className="font-medium">{recommendation.battery?.specs?.warranty_years ? `${recommendation.battery.specs.warranty_years} anos` : 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Inverter Specs */}
                        {recommendation.inverter && (
                            <div className="rounded-2xl border border-gray-200 p-6 flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-blue-100 rounded-lg"><Zap className="w-5 h-5 text-blue-600" /></div>
                                        <h3 className="text-lg font-bold">Inversor</h3>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <button
                                            onClick={() => scrollToSpecs('inverter')}
                                            className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
                                        >
                                            <Info className="w-3 h-3" /> Ver especificações
                                        </button>
                                        {recommendation.inverter?.links?.url && (
                                            <a href={recommendation.inverter.links.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 hover:text-blue-600 hover:underline">
                                                Ver no Marketplace →
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <p className="text-base font-semibold text-gray-900 mb-4">{recommendation.inverter?.brand} {recommendation.inverter?.model}</p>

                                <div className="space-y-3 text-sm flex-1">
                                    <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                        <div className="flex justify-between border-b border-gray-100 pb-1">
                                            <span className="text-gray-500">Potência AC:</span>
                                            <span className="font-medium">{recommendation.inverter?.specs?.power_kw ? `${recommendation.inverter.specs.power_kw} kW` : 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-100 pb-1">
                                            <span className="text-gray-500">Garantia:</span>
                                            <span className="font-medium">{recommendation.inverter?.specs?.warranty_years ? `${recommendation.inverter.specs.warranty_years} anos` : 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                {recommendation.existing_inverter_action === 'replace' && recommendation.replacement_notes?.length > 0 && (
                                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex gap-2 items-start text-left">
                                        <div className="mt-0.5">⚠️</div>
                                        <div className="space-y-1 font-medium text-left">
                                            {recommendation.replacement_notes.map((note: string, i: number) => (
                                                <p key={i}>{note}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Solar Panels Specs */}
                        {recommendation.solar_panels && (
                            <div className="rounded-2xl border border-gray-200 p-6 lg:col-span-2">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-yellow-100 rounded-lg"><Sun className="w-5 h-5 text-yellow-600" /></div>
                                        <h3 className="text-lg font-bold">Painéis Solares</h3>
                                    </div>
                                    {recommendation.solar_panels.panel && (
                                        <div className="flex flex-col items-end gap-1">
                                            <button
                                                onClick={() => scrollToSpecs('panels')}
                                                className="text-xs text-yellow-700 font-semibold hover:underline flex items-center gap-1"
                                            >
                                                <Info className="w-3 h-3" /> Ver especificações
                                            </button>
                                            {recommendation.solar_panels.panel?.links?.url && (
                                                <a href={recommendation.solar_panels.panel.links.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 hover:text-yellow-700 hover:underline">
                                                    Ver no Marketplace →
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid md:grid-cols-2 gap-6 text-left">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 mb-2">
                                            {recommendation.solar_panels.expanded
                                                ? `Painéis existentes + ${recommendation.solar_panels.quantity} x ${recommendation.solar_panels.panel?.brand} ${recommendation.solar_panels.panel?.model}`
                                                : recommendation.solar_panels.existing
                                                    ? 'Módulo de painéis solares existentes'
                                                    : `${recommendation.solar_panels.quantity} x ${recommendation.solar_panels.panel?.brand} ${recommendation.solar_panels.panel?.model}`}
                                        </p>

                                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2 text-sm">
                                            <p className="flex justify-between"><span className="text-gray-500">Potência Total:</span> <span className="font-bold">{recommendation.solar_panels.array_power_kwp} kWp</span></p>
                                            {recommendation.solar_panels.expanded && (
                                                <>
                                                    <p className="flex justify-between"><span className="text-gray-500">Potência Existente:</span> <span>{recommendation.solar_panels.existing_power_kwp} kWp</span></p>
                                                    <p className="flex justify-between"><span className="text-gray-500">Potência Nova:</span> <span>{recommendation.solar_panels.added_power_kwp} kWp</span></p>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        {recommendation.solar_panels.roof_area_m2 && (
                                            <>
                                                <p className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">Área est. telhado:</span> <span className="font-medium">{recommendation.solar_panels.roof_area_m2} m²</span></p>
                                                <p className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">Área ocupada:</span> <span className="font-medium">{recommendation.solar_panels.total_panel_area_m2} m²</span></p>
                                            </>
                                        )}
                                        {(!recommendation.solar_panels.existing || recommendation.solar_panels.expanded) && (
                                            <>
                                                <p className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">Potência unitária (novo):</span> <span className="font-medium">{recommendation.solar_panels.panel?.specs?.power_w || 'N/A'} W</span></p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Full Specs Accordion */}
                    <div ref={accordionRef} className="pt-4 text-left">
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-xl font-bold">Especificações Técnicas Completas</h3>
                        </div>
                        <Accordion type="single" collapsible value={openItem} onValueChange={setOpenItem} className="w-full space-y-4">
                            {recommendation.battery && (
                                <AccordionItem value="battery" className="border rounded-2xl px-6 bg-white shadow-sm border-gray-200">
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div className="flex items-center gap-3">
                                            <Battery className="w-5 h-5 text-orange-600" />
                                            <span className="font-bold text-lg text-gray-900">Bateria: {recommendation.battery.brand} {recommendation.battery.model}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-6">
                                        {renderSpecTable(recommendation.battery.specs, 'battery')}
                                        {recommendation.battery.links?.url && (
                                            <div className="mt-4">
                                                <a href={recommendation.battery.links.url} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 hover:underline font-medium">
                                                    Ver no Marketplace →
                                                </a>
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            )}

                            {recommendation.inverter && (
                                <AccordionItem value="inverter" className="border rounded-2xl px-6 bg-white shadow-sm border-gray-200">
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div className="flex items-center gap-3">
                                            <Zap className="w-5 h-5 text-blue-600" />
                                            <span className="font-bold text-lg text-gray-900">Inversor: {recommendation.inverter.brand} {recommendation.inverter.model}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-6">
                                        {renderSpecTable(recommendation.inverter.specs, 'inverter')}
                                        {recommendation.inverter.links?.url && (
                                            <div className="mt-4">
                                                <a href={recommendation.inverter.links.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline font-medium">
                                                    Ver no Marketplace →
                                                </a>
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            )}

                            {recommendation.solar_panels?.panel && (
                                <AccordionItem value="panels" className="border rounded-2xl px-6 bg-white shadow-sm border-gray-200">
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div className="flex items-center gap-3">
                                            <Sun className="w-5 h-5 text-yellow-600" />
                                            <span className="font-bold text-lg text-gray-900">Painéis: {recommendation.solar_panels.panel.brand} {recommendation.solar_panels.panel.model}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-6">
                                        {renderSpecTable(recommendation.solar_panels.panel.specs, 'panels')}
                                        {recommendation.solar_panels.panel.links?.url && (
                                            <div className="mt-4">
                                                <a href={recommendation.solar_panels.panel.links.url} target="_blank" rel="noopener noreferrer" className="text-sm text-yellow-700 hover:underline font-medium">
                                                    Ver no Marketplace →
                                                </a>
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            )}
                        </Accordion>
                    </div>

                    {/* Price Breakdown */}
                    <div className="rounded-2xl border border-gray-200 p-6 bg-white text-left">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold">Preço discriminado</h3>
                                <p className="text-sm text-gray-500">Valores estimados por componente.</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs uppercase text-gray-500 font-semibold">Total estimado</p>
                                <p className="text-2xl font-extrabold text-orange-600">{formatPrice(recommendation.capex_total_eur)}</p>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-gray-100">
                            <div className="grid grid-cols-[1fr_120px] gap-3 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase text-gray-500">
                                <span>Item</span>
                                <span className="text-right">Preço</span>
                            </div>
                            {priceRows.map((row) => (
                                <div key={row.label} className="grid grid-cols-[1fr_120px] gap-3 border-t border-gray-100 px-4 py-3 text-sm">
                                    <span className="font-medium text-gray-800">{row.label}</span>
                                    <span className="text-right font-semibold text-gray-900">{formatPrice(row.value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3 sm:flex-row pt-4 sticky bottom-0 bg-white pb-4 border-t border-gray-100 mt-4">
                        <Button
                            className="flex-1 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-black h-12"
                            onClick={onClose}
                        >
                            Fechar Detalhes
                        </Button>
                        <Button
                            className="flex-1 bg-black text-white hover:bg-gray-800 h-12 shadow-lg hover:shadow-xl transition-all"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRequestQuote(recommendation);
                            }}
                        >
                            Solicitar Orçamento Deste Sistema
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
