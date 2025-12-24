import { Configuration } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WiringDiagramProps {
    config: Configuration;
}

export const WiringDiagram = ({ config }: WiringDiagramProps) => {
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

    // Pontos Terminais do Pack (Assumindo (-) à esquerda e (+) à direita para simplificar o diagrama)
    const packNegX = batStartX;
    const packNegY = batStartY + packHeight / 2;
    const packPosX = batStartX + packWidth;
    const packPosY = batStartY + packHeight / 2;

    // --- POSIÇÕES DOS COMPONENTES (Centrado) ---
    const pos = {
        // Topo
        bms: { x: centerX - 80, y: 30, w: 160, h: 80 },

        // Esquerda (Negativo)
        shunt: { x: batStartX - 160, y: packNegY + 50, w: 100, h: 40 },

        // Direita (Positivo)
        fuse: { x: packPosX + 80, y: packPosY + 50, w: 80, h: 30 },
        relay: { x: packPosX + 0, y: packPosY + 100, w: 90, h: 60 },

        // Fundo
        load: { x: centerX - 50, y: batStartY + packHeight + 100, w: 100, h: 100 }
    }

    const shuntAnchors = {
        bat: {
            x: pos.shunt.x + pos.shunt.w / 2,
            y: pos.shunt.y - 25,
        },
        load: {
            x: pos.shunt.x + pos.shunt.w / 2,
            y: pos.shunt.y + pos.shunt.h + 25,
        },
    };


    const fuseAnchors = {
        in: {
            x: pos.fuse.x + pos.fuse.w / 2,
            y: pos.fuse.y - 25,
        },
        out: {
            x: pos.fuse.x + pos.fuse.w / 2,
            y: pos.fuse.y + pos.fuse.h + 25,
        },
    };

    const hasShunt = !!config.shunt;
    const hasFuse = !!config.fuse;
    const hasRelay = !!config.relay;

    // --- RENDERIZAR PACK DE BATERIAS ---
    const renderBatteryPack = () => {
        const elements = [];
        for (let col = 0; col < s; col++) {
            const groupX = batStartX + (col * (cellW + gapX));

            // Nickel Strips Verticais
            elements.push(<rect key={`bus-l-${col}`} x={groupX - 3} y={batStartY} width={3} height={packHeight} fill="#94a3b8" rx={1} />);
            elements.push(<rect key={`bus-r-${col}`} x={groupX + cellW} y={batStartY} width={3} height={packHeight} fill="#94a3b8" rx={1} />);

            // Células
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
            // Série
            if (col < s - 1) {
                const nextGroupX = batStartX + ((col + 1) * (cellW + gapX));
                elements.push(
                    <path key={`series-${col}`} d={`M ${groupX + cellW + 3} ${packPosY} L ${nextGroupX - 3} ${packPosY}`} stroke="#64748b" strokeWidth="4" />
                );
            }
        }
        return elements;
    };

    // --- RENDERIZAR SENSE WIRES (Vermelhos Finos para cima) ---
    const renderSenseWires = () => {
        const wires = [];
        for (let col = 0; col < s; col++) {
            const groupX = batStartX + (col * (cellW + gapX));
            // Sai do topo do barramento positivo de cada grupo
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
                    🔌 Assembly Diagram: {s}S {p}P (Central Layout)
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
                        <text x={centerX} y={batStartY + packHeight + 30} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#64748b">Battery Pack</text>

                        {renderBatteryPack()}
                        {renderSenseWires()}

                        {/* ================= COMPONENTES ================= */}

                        {/* 1. BMS (TOPO) */}
                        <g transform={`translate(${pos.bms.x}, ${pos.bms.y})`}>
                            <rect width={pos.bms.w} height={pos.bms.h} rx="4" fill="#eff6ff" stroke="#2563eb" strokeWidth="2" />
                            <text x={pos.bms.w / 2} y="35" textAnchor="middle" fontWeight="bold" fill="#1e40af">BMS</text>
                            {/* Terminais */}
                            <circle cx="10" cy="40" r="4" fill="black" /> <text x="25" y="45" fontSize="10">B-</text>
                            <circle cx={pos.bms.w - 10} cy="40" r="4" fill="#dc2626" /> <text x={pos.bms.w - 35} y="45" fontSize="10">B+</text>
                        </g>

                        {/* 2. SHUNT (ESQUERDA) */}
                        {hasShunt && (
                            <g transform={`translate(${pos.shunt.x}, ${pos.shunt.y})rotate(-90, ${pos.shunt.w / 2}, ${pos.shunt.h / 2})`}>
                                <rect width={pos.shunt.w} height={pos.shunt.h} fill="#f1f5f9" stroke="#0f172a" strokeWidth="2" />
                                <text x={pos.shunt.w / 2} y="25" textAnchor="middle" fontSize="12" fontWeight="bold">SHUNT</text>
                                <circle cx="5" cy={pos.shunt.h / 2} r="4" fill="black" /> <text x="5" y="-5" fontSize="10" textAnchor="middle">Load</text>
                                <circle cx={pos.shunt.w - 5} cy={pos.shunt.h / 2} r="4" fill="black" /> <text x={pos.shunt.w - 5} y="-5" fontSize="10" textAnchor="middle">Bat</text>
                            </g>
                        )}

                        {/* 3. FUSE (DIREITA CIMA) */}
                        {hasFuse && (
                            <g
                                transform={`translate(${pos.fuse.x}, ${pos.fuse.y})rotate(90, ${pos.fuse.w / 2}, ${pos.fuse.h / 2})`}
                            >
                                <rect
                                    x={0}
                                    y={0}
                                    width={pos.fuse.w}
                                    height={pos.fuse.h}
                                    rx="4"
                                    fill="#fef3c7"
                                    stroke="#d97706"
                                    strokeWidth="2"
                                />
                                <text
                                    x={pos.fuse.w / 2}
                                    y={pos.fuse.h / 2 + 4}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fontWeight="bold"
                                >
                                    FUSE
                                </text>
                            </g>
                        )}

                        {/* 4. RELAY (DIREITA BAIXO) */}
                        {hasRelay && (
                            <g transform={`translate(${pos.relay.x}, ${pos.relay.y})`}>
                                <rect width={pos.relay.w} height={pos.relay.h} rx="4" fill="#f3f4f6" stroke="#4b5563" strokeWidth="2" />
                                <text x={pos.relay.w / 2} y="35" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#374151">RELAY</text>
                                <circle cx="5" cy={pos.relay.h / 2} r="4" fill="#dc2626" />
                                <circle cx={pos.relay.w - 5} cy={pos.relay.h / 2} r="4" fill="#dc2626" />
                            </g>
                        )}

                        {/* 5. LOAD (FUNDO) */}
                        <g transform={`translate(${pos.load.x}, ${pos.load.y})`}>
                            <rect width={pos.load.w} height={pos.load.h} rx="5" fill="#f8fafc" stroke="#64748b" strokeWidth="2" strokeDasharray="4,4" />
                            <text x={pos.load.w / 2} y="55" textAnchor="middle" fontWeight="bold" fill="#64748b">LOAD</text>
                        </g>


                        {/* ================= CABLAGEM DINÂMICA ================= */}

                        {/* --- NEGATIVO (PRETO) --- */}
                        {hasShunt ? (
                            <>
                                {/* Bat -> Shunt */}
                                <path d={`M ${packNegX} ${packNegY} L ${shuntAnchors.bat.x} ${packNegY} L ${shuntAnchors.bat.x} ${shuntAnchors.bat.y}`} fill="none" stroke="black" strokeWidth="5" />
                                {/* Shunt -> Load */}
                                <path d={`M ${shuntAnchors.load.x} ${shuntAnchors.load.y} L ${shuntAnchors.load.x} ${pos.load.y + 20} L ${pos.load.x} ${pos.load.y + 20}`} fill="none" stroke="black" strokeWidth="5" />
                                {/* BMS Sense (Shunt Side) */}
                                <path d={`M ${shuntAnchors.bat.x} ${shuntAnchors.bat.y} L ${shuntAnchors.bat.x} ${pos.bms.y + 40} L ${pos.bms.x + 10} ${pos.bms.y + 40}`} fill="none" stroke="black" strokeWidth="2" strokeDasharray="3,2" />
                            </>
                        ) : (
                            <>
                                {/* Direct: Bat -> Load */}
                                <path d={`M ${packNegX} ${packNegY} L ${pos.shunt.x} ${packNegY} L ${pos.shunt.x} ${pos.load.y + 20} L ${pos.load.x} ${pos.load.y + 20}`} fill="none" stroke="black" strokeWidth="5" />
                                {/* BMS Sense (Direct Bat Side) */}
                                <path d={`M ${packNegX + 20} ${packNegY} L ${packNegX + 20} ${pos.bms.y + 40} L ${pos.bms.x + 10} ${pos.bms.y + 40}`} fill="none" stroke="black" strokeWidth="2" strokeDasharray="3,2" />
                            </>
                        )}

                        {/* --- POSITIVO (VERMELHO) --- */}
                        {/* Lógica: Bat -> (Fuse?) -> (Relay?) -> Load */}

                        {/* 1. Bat -> Primeiro Componente */}
                        <path
                            d={`M ${packPosX} ${packPosY} 
                    L ${hasFuse ? fuseAnchors.in.x : (hasRelay ? pos.relay.x + 20 : pos.load.x + pos.load.w)} ${packPosY}
                    ${hasFuse ? `L ${fuseAnchors.in.x} ${fuseAnchors.in.y}` : (hasRelay ? `L ${pos.relay.x + 20} ${pos.relay.y}` : `L ${pos.load.x + pos.load.w} ${pos.load.y + 20}`)}`}
                            fill="none" stroke="#dc2626" strokeWidth="5"
                        />

                        {/* 2. Ligação Fuse -> Próximo (se Fuse existir) */}
                        {hasFuse && (
                            <path
                                d={`M ${fuseAnchors.out.x} ${fuseAnchors.out.y} 
                    L ${fuseAnchors.out.x} ${hasRelay ? pos.relay.y + pos.relay.h / 2 : pos.load.y + 20}
                    L ${hasRelay ? pos.relay.x + pos.relay.w : pos.load.x + pos.load.w} ${hasRelay ? pos.relay.y + pos.relay.h / 2 : pos.load.y + 20}`}
                                fill="none" stroke="#dc2626" strokeWidth="5"
                            />
                        )}

                        {/* 3. Ligação Relay -> Load (se Relay existir) */}
                        {hasRelay && (
                            <path
                                d={`M ${pos.relay.x} ${pos.relay.y + pos.relay.h / 2} 
                    L ${pos.relay.x - 20} ${pos.relay.y + pos.relay.h / 2}
                    L ${pos.relay.x - 20} ${pos.load.y + 20}
                    L ${pos.load.x + pos.load.w} ${pos.load.y + 20}`}
                                fill="none" stroke="#dc2626" strokeWidth="5"
                            />
                        )}

                        {/* 4. BMS Power B+ (Ligado sempre antes do Fuse/Relay) */}
                        <path d={`M ${packPosX + 5} ${packPosY} L ${packPosX + 5} ${pos.bms.y + 40} L ${pos.bms.x + pos.bms.w} ${pos.bms.y + 40}`} fill="none" stroke="#dc2626" strokeWidth="2" strokeDasharray="3,2" />


                        {/* --- CONTROL / DATA LINES --- */}

                        {/* Shunt Data (Orange) */}
                        {hasShunt && (
                            <>  {/* <--- ADICIONAR ESTE FRAGMENTO */}
                                <path
                                    d={`M ${pos.shunt.x + 85} ${pos.shunt.y + 20} 
                                    C ${pos.shunt.x - 50} ${pos.shunt.y + 50}, 
                                    ${pos.bms.x + 30} ${pos.bms.y + 100}, 
                                    ${pos.bms.x + 30} ${pos.bms.y + pos.bms.h}`}
                                    fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3,3"
                                />
                                <text x={pos.shunt.x + 10} y={pos.shunt.y + 30} fontSize="14" fill="#f59e0b" transform="rotate(-15)">Current Reading</text>
                            </>
                        )}

                        {/* Relay Control (Blue) */}
                        {hasRelay && (
                            <> {/* <--- ADICIONAR ESTE FRAGMENTO */}
                                <path
                                    d={`M ${pos.bms.x + pos.bms.w - 30} ${pos.bms.y + pos.bms.h} 
                                    C ${pos.bms.x + pos.bms.w - 30} ${pos.bms.y + 100}, 
                                    ${pos.relay.x + 20} ${pos.relay.y - 30}, 
                                    ${pos.relay.x + 20} ${pos.relay.y}`}
                                    fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="3,3"
                                />
                                <text x={pos.relay.x} y={pos.relay.y - 10} fontSize="14" fill="#2563eb">Cutoff Signal</text>
                            </>
                        )}
                    </svg>
                </div>

                {/* INSTRUÇÕES (Mantidas em Inglês Técnico) */}
                <div className="px-8 pb-8 bg-white text-slate-700">
                    <h4 className="font-bold mb-3 text-lg border-b pb-2">Layout & Wiring Guide</h4>
                    <div className="grid md:grid-cols-2 gap-6 text-sm">
                        {/* Secção Negativa */}
                        <div>
                            <p className="font-semibold text-emerald-700 mb-1">
                                2. Negative Path {hasShunt ? "(With Shunt)" : "(Integrated)"}
                            </p>
                            <ul className="list-disc pl-4 space-y-1 text-slate-600">
                                {hasShunt ? (
                                    <>
                                        <li><strong>Shunt:</strong> Connects between Battery (-) and Load (-).</li>
                                        <li><strong>Current:</strong> Return current is measured here.</li>
                                    </>
                                ) : (
                                    <li><strong>Direct:</strong> Connect Battery (-) directly to Load (-). Current sensing is internal to BMS.</li>
                                )}
                            </ul>
                        </div>

                        {/* Secção Positiva */}
                        <div>
                            <p className="font-semibold text-emerald-700 mb-1">
                                3. Positive Path {hasRelay ? "(With Relay)" : "(Solid State)"}
                            </p>
                            <ul className="list-disc pl-4 space-y-1 text-slate-600">
                                {hasFuse && <li><strong>Fuse:</strong> Connects to Battery (+).</li>}
                                {hasRelay ? (
                                    <li><strong>Relay:</strong> Controlled switch between {hasFuse ? "Fuse" : "Battery"} and Load.</li>
                                ) : (
                                    <li><strong>Direct:</strong> Connect {hasFuse ? "Fuse output" : "Battery (+)"} to Load (+). Protection is internal.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};