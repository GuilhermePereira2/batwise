import { Configuration } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

interface WiringDiagramProps {
    config: Configuration;
}

export const WiringDiagram = ({ config }: WiringDiagramProps) => {
    const { t } = useTranslation();

    // --- CONFIGURAÇÕES DE ESCALA ---
    const s = config.series_cells;
    const p = config.parallel_cells;

    // Tamanho das Células (Horizontais)
    const cellW = 50;
    const cellH = 20;
    const gapX = 20; // Espaço horizontal entre grupos
    const gapY = 10; // Espaço vertical entre células

    // Dimensões do Pack
    const packWidth = (s * cellW) + ((s - 1) * gapX);
    const packHeight = (p * cellH) + ((p - 1) * gapY);

    // Layout SVG Global
    const width = Math.max(packWidth + 400, 900); // Mais largo para componentes laterais
    const height = packHeight + 450; // Mais alto para BMS (topo) e Load (fundo)

    const centerX = width / 2;
    const batStartX = centerX - (packWidth / 2);
    const batStartY = 180; // Espaço para o BMS em cima

    // Pontos Terminais do Pack
    const packNegX = batStartX;
    const packNegY = batStartY + packHeight / 2;
    const packPosX = batStartX + packWidth;
    const packPosY = batStartY + packHeight / 2;

    // --- POSIÇÕES DOS COMPONENTES (Centrado) ---
    const pos = {
        bms: { x: centerX - 80, y: 30, w: 160, h: 80 },
        shunt: { x: batStartX - 160, y: packNegY + 50, w: 100, h: 40 },
        fuse: { x: packPosX + 80, y: packPosY + 50, w: 80, h: 30 },
        relay: { x: packPosX + 0, y: batStartY + packHeight + 80, w: 90, h: 60 },
        load: { x: centerX - 50, y: batStartY + packHeight + 100, w: 100, h: 100 }
    }

    const shuntAnchors = {
        bat: { x: pos.shunt.x + pos.shunt.w / 2, y: pos.shunt.y - 25 },
        load: { x: pos.shunt.x + pos.shunt.w / 2, y: pos.shunt.y + pos.shunt.h + 25 },
    };

    const fuseAnchors = {
        in: { x: pos.fuse.x + pos.fuse.w / 2, y: pos.fuse.y - 25 },
        out: { x: pos.fuse.x + pos.fuse.w / 2, y: pos.fuse.y + pos.fuse.h + 25 },
    };

    const hasShunt = !!config.shunt;
    const hasFuse = !!config.fuse;
    const hasRelay = !!config.relay;

    // --- RENDERIZAR PACK DE BATERIAS ---
    const renderBatteryPack = () => {
        const elements = [];
        for (let col = 0; col < s; col++) {
            const groupX = batStartX + (col * (cellW + gapX));

            elements.push(<rect key={`bus-l-${col}`} x={groupX - 3} y={batStartY} width={3} height={packHeight} fill="#94a3b8" rx={1} />);
            elements.push(<rect key={`bus-r-${col}`} x={groupX + cellW} y={batStartY} width={3} height={packHeight} fill="#94a3b8" rx={1} />);

            for (let row = 0; row < p; row++) {
                const cellY = batStartY + (row * (cellH + gapY));
                elements.push(
                    <g key={`c-${col}-${row}`}>
                        <rect x={groupX} y={cellY} width={cellW} height={cellH} rx={3} fill="#eff6ff" stroke="#3b82f6" strokeWidth="1" />
                        <text x={groupX + 5} y={cellY + 14} fontSize="9" fill="#1e293b" fontWeight="bold">-</text>
                        <text x={groupX + cellW - 8} y={cellY + 14} fontSize="9" fill="#dc2626" fontWeight="bold">+</text>
                    </g>
                );
            }
            if (col < s - 1) {
                const nextGroupX = batStartX + ((col + 1) * (cellW + gapX));
                elements.push(
                    <path key={`series-${col}`} d={`M ${groupX + cellW + 3} ${packPosY} L ${nextGroupX - 3} ${packPosY}`} stroke="#64748b" strokeWidth="4" />
                );
            }
        }
        return elements;
    };

    // --- RENDERIZAR SENSE WIRES ---
    const renderSenseWires = () => {
        const wires = [];
        for (let col = 0; col < s; col++) {
            const groupX = batStartX + (col * (cellW + gapX));
            wires.push(
                <path
                    key={`sense-${col}`}
                    d={`M ${groupX + cellW} ${batStartY} 
                    L ${groupX + cellW} ${batStartY - 20} 
                    L ${pos.bms.x + 10 + (col * (140 / s))} ${batStartY - 20}
                    L ${pos.bms.x + 10 + (col * (140 / s))} ${pos.bms.y + pos.bms.h}`}
                    fill="none" stroke="red" strokeWidth="1" opacity="0.5"
                />
            );
        }
        return wires;
    };

    return (
        <Card className="mt-6 border-slate-300 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    🔌 {t('wiring.title', { s, p })}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
                <div className="min-w-[800px] flex justify-center p-6">
                    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="max-w-[1000px] font-sans">
                        <defs>
                            <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#000" /></marker>
                        </defs>

                        {/* --- PACK BOX --- */}
                        <rect x={batStartX - 15} y={batStartY - 15} width={packWidth + 30} height={packHeight + 30} rx="10" fill="none" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="5,5" />
                        <text x={centerX} y={batStartY + packHeight + 30} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#64748b">{t('wiring.svg.batteryPack')}</text>

                        {renderBatteryPack()}
                        {renderSenseWires()}

                        {/* ================= COMPONENTES ================= */}

                        {/* 1. BMS (TOPO) */}
                        <g transform={`translate(${pos.bms.x}, ${pos.bms.y})`}>
                            <rect width={pos.bms.w} height={pos.bms.h} rx="4" fill="#eff6ff" stroke="#2563eb" strokeWidth="2" />
                            <text x={pos.bms.w / 2} y="35" textAnchor="middle" fontWeight="bold" fill="#1e40af">BMS</text>
                            <circle cx="10" cy="40" r="4" fill="black" /> <text x="25" y="45" fontSize="10">B-</text>
                            <circle cx={pos.bms.w - 10} cy="40" r="4" fill="#dc2626" /> <text x={pos.bms.w - 35} y="45" fontSize="10">B+</text>
                        </g>

                        {/* 2. SHUNT (ESQUERDA) */}
                        {hasShunt && (
                            <g transform={`translate(${pos.shunt.x}, ${pos.shunt.y})rotate(-90, ${pos.shunt.w / 2}, ${pos.shunt.h / 2})`}>
                                <rect width={pos.shunt.w} height={pos.shunt.h} fill="#f1f5f9" stroke="#0f172a" strokeWidth="2" />
                                <text x={pos.shunt.w / 2} y="25" textAnchor="middle" fontSize="12" fontWeight="bold">SHUNT</text>
                                <circle cx="5" cy={pos.shunt.h / 2} r="4" fill="black" /> <text x="5" y="-5" fontSize="10" textAnchor="middle">{t('wiring.svg.load')}</text>
                                <circle cx={pos.shunt.w - 5} cy={pos.shunt.h / 2} r="4" fill="black" /> <text x={pos.shunt.w - 5} y="-5" fontSize="10" textAnchor="middle">{t('wiring.svg.bat')}</text>
                            </g>
                        )}

                        {/* 3. FUSE (DIREITA CIMA) */}
                        {hasFuse && (
                            <g transform={`translate(${pos.fuse.x}, ${pos.fuse.y})rotate(90, ${pos.fuse.w / 2}, ${pos.fuse.h / 2})`}>
                                <rect x={0} y={0} width={pos.fuse.w} height={pos.fuse.h} rx="4" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
                                <text x={pos.fuse.w / 2} y={pos.fuse.h / 2 + 4} textAnchor="middle" fontSize="10" fontWeight="bold">
                                    {t('wiring.svg.fuse')}
                                </text>
                            </g>
                        )}

                        {/* 4. RELAY (DIREITA BAIXO) */}
                        {hasRelay && (
                            <g transform={`translate(${pos.relay.x}, ${pos.relay.y})`}>
                                <rect width={pos.relay.w} height={pos.relay.h} rx="4" fill="#f3f4f6" stroke="#4b5563" strokeWidth="2" />
                                <text x={pos.relay.w / 2} y="35" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#374151">{t('wiring.svg.relay')}</text>
                                <circle cx="5" cy={pos.relay.h / 2} r="4" fill="#dc2626" />
                                <circle cx={pos.relay.w - 5} cy={pos.relay.h / 2} r="4" fill="#dc2626" />
                            </g>
                        )}

                        {/* 5. LOAD (FUNDO) */}
                        <g transform={`translate(${pos.load.x}, ${pos.load.y})`}>
                            <rect width={pos.load.w} height={pos.load.h} rx="5" fill="#f8fafc" stroke="#64748b" strokeWidth="2" strokeDasharray="4,4" />
                            <text x={pos.load.w / 2} y="55" textAnchor="middle" fontWeight="bold" fill="#64748b">{t('wiring.svg.loadCaps')}</text>
                        </g>

                        {/* ================= CABLAGEM DINÂMICA ================= */}

                        {/* --- NEGATIVO (PRETO) --- */}
                        {hasShunt ? (
                            <>
                                <path d={`M ${packNegX} ${packNegY} L ${shuntAnchors.bat.x} ${packNegY} L ${shuntAnchors.bat.x} ${shuntAnchors.bat.y}`} fill="none" stroke="black" strokeWidth="5" />
                                <path d={`M ${shuntAnchors.load.x} ${shuntAnchors.load.y} L ${shuntAnchors.load.x} ${pos.load.y + 20} L ${pos.load.x} ${pos.load.y + 20}`} fill="none" stroke="black" strokeWidth="5" />
                                <path d={`M ${packNegX - 5} ${packNegY} L ${packNegX - 5} ${pos.bms.y + 40} L ${pos.bms.x + 10} ${pos.bms.y + 40}`} fill="none" stroke="black" strokeWidth="2" strokeDasharray="3,2" />
                            </>
                        ) : (
                            <>
                                <path d={`M ${packNegX} ${packNegY} L ${pos.shunt.x} ${packNegY} L ${pos.shunt.x} ${pos.load.y + 20} L ${pos.load.x} ${pos.load.y + 20}`} fill="none" stroke="black" strokeWidth="5" />
                                <path d={`M ${packNegX - 5} ${packNegY} L ${packNegX - 5} ${pos.bms.y + 40} L ${pos.bms.x + 10} ${pos.bms.y + 40}`} fill="none" stroke="black" strokeWidth="2" strokeDasharray="3,2" />
                            </>
                        )}

                        {/* --- POSITIVO (VERMELHO) --- */}
                        <path
                            d={`M ${packPosX} ${packPosY} 
                    L ${hasFuse ? fuseAnchors.in.x : (hasRelay ? pos.relay.x + 20 : pos.load.x + pos.load.w)} ${packPosY}
                    ${hasFuse ? `L ${fuseAnchors.in.x} ${fuseAnchors.in.y}` : (hasRelay ? `L ${pos.relay.x + 20} ${pos.relay.y}` : `L ${pos.load.x + pos.load.w} ${pos.load.y + 20}`)}`}
                            fill="none" stroke="#dc2626" strokeWidth="5"
                        />

                        {hasFuse && (
                            <path
                                d={`M ${fuseAnchors.out.x} ${fuseAnchors.out.y} 
                    L ${fuseAnchors.out.x} ${hasRelay ? pos.relay.y + pos.relay.h / 2 : pos.load.y + 20}
                    L ${hasRelay ? pos.relay.x + pos.relay.w : pos.load.x + pos.load.w} ${hasRelay ? pos.relay.y + pos.relay.h / 2 : pos.load.y + 20}`}
                                fill="none" stroke="#dc2626" strokeWidth="5"
                            />
                        )}

                        {hasRelay && (
                            <path
                                d={`M ${pos.relay.x} ${pos.relay.y + pos.relay.h / 2} 
                    L ${pos.relay.x - 20} ${pos.relay.y + pos.relay.h / 2}
                    L ${pos.relay.x - 20} ${pos.load.y + 20}
                    L ${pos.load.x + pos.load.w} ${pos.load.y + 20}`}
                                fill="none" stroke="#dc2626" strokeWidth="5"
                            />
                        )}

                        <path d={`M ${packPosX + 5} ${packPosY} L ${packPosX + 5} ${pos.bms.y + 40} L ${pos.bms.x + pos.bms.w} ${pos.bms.y + 40}`} fill="none" stroke="#dc2626" strokeWidth="2" strokeDasharray="3,2" />

                        {/* --- CONTROL / DATA LINES --- */}
                        {hasShunt && (
                            <>
                                <path
                                    d={`M ${pos.shunt.x + 85} ${pos.shunt.y + 20} 
                                    C ${pos.shunt.x - 50} ${pos.shunt.y + 50}, 
                                    ${pos.bms.x + 30} ${pos.bms.y + 100}, 
                                    ${pos.bms.x + 30} ${pos.bms.y + pos.bms.h}`}
                                    fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3,3"
                                />
                                <text x={pos.shunt.x + 10} y={pos.shunt.y + 30} fontSize="14" fill="#f59e0b" transform="rotate(-15)">{t('wiring.svg.currentReading')}</text>
                            </>
                        )}

                        {hasRelay && (
                            <>
                                <path
                                    d={`M ${pos.bms.x + pos.bms.w - 30} ${pos.bms.y + pos.bms.h} 
                                    C ${pos.bms.x + pos.bms.w - 30} ${pos.bms.y + 100}, 
                                    ${pos.relay.x + 20} ${pos.relay.y - 30}, 
                                    ${pos.relay.x + 20} ${pos.relay.y}`}
                                    fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="3,3"
                                />
                                <text x={pos.relay.x} y={pos.relay.y - 10} fontSize="14" fill="#2563eb">{t('wiring.svg.cutoffSignal')}</text>
                            </>
                        )}
                    </svg>
                </div>

                {/* --- ASSEMBLY INSTRUCTIONS --- */}
                <div className="px-8 pb-8 bg-white text-slate-700">
                    <h4 className="font-bold mb-4 text-lg border-b pb-2 flex items-center gap-2">
                        🛠️ {t('wiring.guide.title')}
                    </h4>

                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className="flex-none w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold border border-slate-200">1</div>
                            <div>
                                <h5 className="font-semibold text-slate-900">{t('wiring.guide.step1Title')}</h5>
                                <p className="text-sm text-slate-600 mt-1">
                                    {t('wiring.guide.step1Desc', { s, p })}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-none w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold border border-blue-100">2</div>
                            <div>
                                <h5 className="font-semibold text-slate-900">{t('wiring.guide.step2Title')}</h5>
                                <ul className="text-sm text-slate-600 mt-1 list-disc pl-4 space-y-1">
                                    <li>{t('wiring.guide.step2Desc1')} <strong>{t('wiring.guide.step2Bold1')}</strong>{t('wiring.guide.step2Desc2')} <strong>{t('wiring.guide.step2Bold2')}</strong>.</li>
                                    <li className="text-amber-600 font-medium">{t('wiring.guide.step2Warning')}</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-none w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold border border-slate-200">3</div>
                            <div>
                                <h5 className="font-semibold text-slate-900">{t('wiring.guide.step3Title')}</h5>
                                <div className="text-sm text-slate-600 mt-1">
                                    {hasShunt ? (
                                        <ul className="list-disc pl-4 space-y-1">
                                            <li>{t('wiring.guide.step3Shunt1_1')} <strong>{t('wiring.guide.step3Shunt1_Bold1')}</strong> {t('wiring.guide.step3Shunt1_2')} <strong>{t('wiring.guide.step3Shunt1_Bold2')}</strong> {t('wiring.guide.step3Shunt1_3')}</li>
                                            <li>{t('wiring.guide.step3Shunt2')}</li>
                                            <li>{t('wiring.guide.step3Shunt3_1')} <strong>{t('wiring.guide.step3Shunt3_Bold')}</strong> {t('wiring.guide.step3Shunt3_2')}</li>
                                            <li><span className="text-blue-600">{t('wiring.guide.step3Shunt4_Bold')}</span> {t('wiring.guide.step3Shunt4_1')}</li>
                                        </ul>
                                    ) : (
                                        <p>
                                            {t('wiring.guide.step3NoShunt1_1')} <strong>{t('wiring.guide.step3NoShunt1_Bold')}</strong> {t('wiring.guide.step3NoShunt1_2')}
                                            <span className="italic text-slate-500"> {t('wiring.guide.step3NoShunt2')}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-none w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold border border-slate-200">4</div>
                            <div>
                                <h5 className="font-semibold text-slate-900">{t('wiring.guide.step4Title')}</h5>
                                <div className="text-sm text-slate-600 mt-1">
                                    <p className="mb-1">{t('wiring.guide.step4Seq')}</p>
                                    <div className="flex items-center gap-2 text-xs font-mono bg-slate-50 p-2 rounded border border-slate-200 w-fit">
                                        <span>BAT (+)</span>
                                        <span>→</span>
                                        {hasFuse ? <span className="font-bold text-amber-700">FUSE</span> : <span className="text-slate-400 line-through">{t('wiring.guide.step4NoFuse')}</span>}
                                        <span>→</span>
                                        {hasRelay ? <span className="font-bold text-blue-700">RELAY</span> : <span className="text-slate-400 line-through">{t('wiring.guide.step4NoRelay')}</span>}
                                        <span>→</span>
                                        <span>LOAD (+)</span>
                                    </div>

                                    <ul className="list-disc pl-4 space-y-1 mt-2">
                                        {hasFuse && <li>{t('wiring.guide.step4Fuse1')} <strong>{t('wiring.guide.step4FuseBold')}</strong> {t('wiring.guide.step4Fuse2')}</li>}
                                        {hasRelay && (
                                            <li>
                                                {t('wiring.guide.step4Relay1')} <strong>{t('wiring.guide.step4RelayBold')}</strong> {t('wiring.guide.step4Relay2')}<br />
                                                {t('wiring.guide.step4Relay3')}
                                            </li>
                                        )}
                                        {!hasFuse && !hasRelay && <li>{t('wiring.guide.step4NoFuseRelay')}</li>}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-none w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-100">5</div>
                            <div>
                                <h5 className="font-semibold text-slate-900">{t('wiring.guide.step5Title')}</h5>
                                <p className="text-sm text-slate-600 mt-1">
                                    {t('wiring.guide.step5Desc')}
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </CardContent>
        </Card>
    );
};