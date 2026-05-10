import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Battery, Zap, Sun } from 'lucide-react';

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
    if (!recommendation) return null;

    const prices = getPriceBreakdown(recommendation);

    return (
        <Dialog open={!!recommendation} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-white p-0">
                <DialogHeader className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <DialogDescription className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Detalhes da recomendação</DialogDescription>
                    <DialogTitle className="text-2xl font-bold mt-1">{getSystemName(recommendation)}</DialogTitle>
                    <p className="text-sm text-gray-500 mt-1">
                        Capacidade simulada: <span className="font-semibold text-gray-700">{recommendation.simulated_capacity_kwh} kWh úteis</span>
                    </p>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {/* Top Highlights */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-gray-200 p-5 bg-gray-50 flex flex-col justify-center">
                            <p className="text-xs uppercase text-gray-500 font-semibold mb-1">Investimento estimado</p>
                            <p className="text-3xl font-bold text-orange-600">{recommendation.capex_total_eur.toLocaleString()}€</p>
                            <p className="text-xs text-gray-500 mt-1">inclui hardware e instalação</p>
                        </div>
                        <div className="rounded-2xl border border-gray-200 p-5 bg-gray-50 flex flex-col justify-center">
                            <p className="text-xs uppercase text-gray-500 font-semibold mb-1">Fatura anual</p>
                            <div className="flex items-end gap-2">
                                <p className="text-3xl font-bold text-gray-900">{formatPrice(recommendation.annual_bill_after_eur)}</p>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 line-through">antes: {formatPrice(recommendation.annual_bill_before_eur)}/ano</p>
                        </div>
                        <div className="rounded-2xl border border-gray-200 p-5 bg-emerald-50 border-emerald-100 flex flex-col justify-center">
                            <p className="text-xs uppercase text-emerald-700 font-semibold mb-1">Retorno (Payback)</p>
                            <p className="text-3xl font-bold text-emerald-700">
                                {recommendation.payback_years ? `${recommendation.payback_years} anos` : 'N/A'}
                            </p>
                            <p className="text-xs text-emerald-600 mt-1 font-medium">
                                poupança: {formatPrice(recommendation.savings_annual_eur)}/ano
                            </p>
                        </div>
                    </div>

                    {/* Hardware Details */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Battery Specs */}
                        <div className="rounded-2xl border border-gray-200 p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-orange-100 rounded-lg"><Battery className="w-5 h-5 text-orange-600" /></div>
                                <h3 className="text-lg font-bold">Bateria</h3>
                            </div>
                            <p className="text-base font-semibold text-gray-900 mb-4">{recommendation.battery?.brand} {recommendation.battery?.model}</p>

                            <div className="space-y-3 text-sm">
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
                                    <p><span className="text-gray-500">Capacidade nova:</span> <span className="font-semibold float-right">{recommendation.new_battery_capacity_kwh || recommendation.simulated_capacity_kwh} kWh</span></p>
                                    {recommendation.existing_battery?.has_battery && (
                                        <>
                                            <p><span className="text-gray-500">Bateria existente:</span> <span className="font-semibold float-right text-right max-w-[200px] truncate">{getExistingBatteryDescription(recommendation.existing_battery)}</span></p>
                                            <div className="border-t border-gray-200 my-1 pt-1">
                                                <p><span className="text-gray-500">Capacidade total:</span> <span className="font-bold float-right">{recommendation.simulated_capacity_kwh} kWh</span></p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Detalhes Técnicos Expandidos da Bateria */}
                                <div className="grid grid-cols-2 gap-y-2 gap-x-4 pt-2">
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="text-gray-500">Tensão Nominal:</span>
                                        <span className="font-medium">{recommendation.battery?.specs?.voltage ? `${recommendation.battery.specs.voltage}V` : 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="text-gray-500">Ciclos Est.:</span>
                                        <span className="font-medium">{recommendation.battery?.specs?.cycles || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="text-gray-500">Química:</span>
                                        <span className="font-medium">{recommendation.battery?.specs?.chemistry || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="text-gray-500">DoD Máx:</span>
                                        <span className="font-medium">{recommendation.battery?.specs?.dod_pct ? `${(recommendation.battery.specs.dod_pct * 100).toFixed(0)}%` : 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="text-gray-500">Peso:</span>
                                        <span className="font-medium">{recommendation.battery?.specs?.weight_kg ? `${recommendation.battery.specs.weight_kg} kg` : 'N/A'}</span>
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
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 bg-blue-100 rounded-lg"><Zap className="w-5 h-5 text-blue-600" /></div>
                                    <h3 className="text-lg font-bold">Inversor Híbrido</h3>
                                </div>
                                <p className="text-base font-semibold text-gray-900 mb-4">{recommendation.inverter?.brand} {recommendation.inverter?.model}</p>

                                <div className="space-y-3 text-sm flex-1">
                                    {/* Detalhes Técnicos Expandidos do Inversor */}
                                    <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                        <div className="flex justify-between border-b border-gray-100 pb-1">
                                            <span className="text-gray-500">Potência AC:</span>
                                            <span className="font-medium">{recommendation.inverter?.specs?.power_kw ? `${recommendation.inverter.specs.power_kw} kW` : 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-100 pb-1">
                                            <span className="text-gray-500">Eficiência:</span>
                                            <span className="font-medium">{recommendation.inverter?.specs?.efficiency || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-100 pb-1">
                                            <span className="text-gray-500">Rede (Fases):</span>
                                            <span className="font-medium">{recommendation.inverter?.specs?.phases === 1 ? 'Monofásico' : recommendation.inverter?.specs?.phases === 3 ? 'Trifásico' : (recommendation.inverter?.specs?.phases || 'N/A')}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-100 pb-1">
                                            <span className="text-gray-500">MPPTs:</span>
                                            <span className="font-medium">{recommendation.inverter?.specs?.mppt_count || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-100 pb-1">
                                            <span className="text-gray-500">Max Solar PV:</span>
                                            <span className="font-medium">{recommendation.inverter?.specs?.max_pv_kw ? `${recommendation.inverter.specs.max_pv_kw} kW` : 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-100 pb-1">
                                            <span className="text-gray-500">Garantia:</span>
                                            <span className="font-medium">{recommendation.inverter?.specs?.warranty_years ? `${recommendation.inverter.specs.warranty_years} anos` : 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                {recommendation.existing_inverter_action === 'replace' && recommendation.replacement_notes?.length > 0 && (
                                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex gap-2 items-start">
                                        <div className="mt-0.5">⚠️</div>
                                        <div className="space-y-1 font-medium">
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
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 bg-yellow-100 rounded-lg"><Sun className="w-5 h-5 text-yellow-600" /></div>
                                    <h3 className="text-lg font-bold">Painéis Solares</h3>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
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
                                                <p className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">Taxa de ocupação:</span> <span className="font-medium">{recommendation.solar_panels.roof_coverage_pct}%</span></p>
                                            </>
                                        )}
                                        {(!recommendation.solar_panels.existing || recommendation.solar_panels.expanded) && (
                                            <>
                                                <p className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">Potência unitária (novo):</span> <span className="font-medium">{recommendation.solar_panels.panel?.specs?.power_w || 'N/A'} W</span></p>
                                                <p className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">Área novos painéis:</span> <span className="font-medium">{recommendation.solar_panels.additional_panel_set?.total_panel_area_m2 || recommendation.solar_panels.total_panel_area_m2} m²</span></p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3 sm:flex-row pt-4">
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