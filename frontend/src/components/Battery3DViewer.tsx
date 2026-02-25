import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, Center, Html } from "@react-three/drei";
import type { Configuration } from "@/pages/diytool/types";

interface Cell3DProps {
    position: [number, number, number];
    width: number;
    height: number;
    thickness: number;
    type?: string;
}

// Componente de seta com dimensão
interface DimensionArrowProps {
    length: number; // comprimento em unidades 3D
    position: [number, number, number];
    rotation?: [number, number, number];
    label: string;
}

const DimensionArrow = ({ length, position, rotation = [0, 0, 0], label }: DimensionArrowProps) => {
    const arrowSize = 0.3;
    
    return (
        <group position={position} rotation={rotation}>
            {/* Linha principal */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[length, 0.08, 0.08]} />
                <meshStandardMaterial color="#f46a25" />
            </mesh>
            
            {/* Seta esquerda */}
            <mesh position={[-length / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <coneGeometry args={[arrowSize, arrowSize * 1.5, 4]} />
                <meshStandardMaterial color="#f46a25" />
            </mesh>
            
            {/* Seta direita */}
            <mesh position={[length / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[arrowSize, arrowSize * 1.5, 4]} />
                <meshStandardMaterial color="#f46a25" />
            </mesh>
            
            {/* Label com dimensão */}
            <Html position={[0, 0.5, 0]} center>
                <div style={{
                    background: '#f46a25',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    pointerEvents: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}>
                    {label}
                </div>
            </Html>
        </group>
    );
}

const Cell3D = ({ position, width, height, thickness }: Cell3DProps) => {
    // Se largura ~ espessura (+- 2mm), assumimos cilíndrica (18650, 21700, etc)
    const isCylindrical = Math.abs(width - thickness) < 2;

    // Conversão de mm para unidades 3D (escala arbitrária, ex: 1 unidade = 10mm)
    const scale = 0.1;
    const w = width * scale;
    const h = height * scale;
    const t = thickness * scale;

    return (
        <group position={position}>
            {isCylindrical ? (
                // Célula Cilíndrica
                // position y = h/2 sobe a célula para ficar apoiada no chão (grid)
                <mesh position={[0, h / 2, 0]}>
                    <cylinderGeometry args={[w / 2, w / 2, h, 32]} />
                    <meshStandardMaterial color="#3b82f6" roughness={0.3} metalness={0.8} />
                </mesh>
            ) : (
                // Célula Prismática
                <mesh position={[0, h / 2, 0]}>
                    <boxGeometry args={[w, h, t]} />
                    <meshStandardMaterial color="#3b82f6" roughness={0.2} metalness={0.5} />
                </mesh>
            )}
        </group>
    );
};

interface BatteryPackProps {
    config: Configuration;
}

const BatteryPack = ({ config }: BatteryPackProps) => {
    useEffect(() => {
        console.log("🔋 Battery3DViewer Data:", {
            layout: config.layout,
            isLayoutArray: Array.isArray(config.layout),
            cellDims: config.cell
        });
    }, [config]);

    if (!config.layout || !Array.isArray(config.layout)) return null;

    const [cols, rows] = config.layout; // Vem do backend (nx, ny)
    const { Cell_Width, Cell_Height, Cell_Thickness } = config.cell;

    const scale = 0.1;
    // Espaçamento visual entre células (2mm convertidos para escala)
    const spacing = 0.2;

    // Calcular dimensões totais do pack
    const totalWidth = cols * Cell_Width;
    const totalDepth = rows * Cell_Thickness;
    
    const cells = [];

    // Gerar grelha de células
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            // Calcular posição baseada na grelha (X e Z definem o chão, Y é altura)
            const x = (i - cols / 2) * (Cell_Width * scale + spacing);
            const z = (j - rows / 2) * (Cell_Thickness * scale + spacing);

            // Apenas desenha se não exceder o número total de células
            const cellIndex = i * rows + j;
            if (cellIndex < (config.series_cells * config.parallel_cells)) {
                cells.push(
                    <Cell3D
                        key={`${i}-${j}`}
                        position={[x, 0, z]}
                        width={Cell_Width}
                        height={Cell_Height}
                        thickness={Cell_Thickness}
                    />
                );
            }
        }
    }

    // Calcular bordas reais do pack
    // Primeira célula (i=0)
    const firstCellCenterX = (0 - cols / 2) * (Cell_Width * scale + spacing);
    const packLeftEdge = firstCellCenterX - (Cell_Width * scale) / 2;
    
    // Última célula (i=cols-1)
    const lastCellCenterX = (cols - 1 - cols / 2) * (Cell_Width * scale + spacing);
    const packRightEdge = lastCellCenterX + (Cell_Width * scale) / 2;
    
    // Comprimento real do pack
    const packWidthUnits = packRightEdge - packLeftEdge;
    const packCenterX = (packLeftEdge + packRightEdge) / 2;
    
    // Mesmo para profundidade (Z)
    const firstCellCenterZ = (0 - rows / 2) * (Cell_Thickness * scale + spacing);
    const packFrontEdge = firstCellCenterZ - (Cell_Thickness * scale) / 2;
    
    const lastCellCenterZ = (rows - 1 - rows / 2) * (Cell_Thickness * scale + spacing);
    const packBackEdge = lastCellCenterZ + (Cell_Thickness * scale) / 2;
    
    const packDepthUnits = packBackEdge - packFrontEdge;
    const packCenterZ = (packFrontEdge + packBackEdge) / 2;
    
    // Posições das setas (mesma distância do pack para ambas)
    const arrowYPosition = 0.0;
    const arrowOffset = 3.0; // Distância fixa do pack
    
    // Posição Z para seta de largura (na frente do pack)
    const widthArrowZ = packBackEdge + arrowOffset;
    // Posição X para seta de profundidade (na lateral direita do pack)
    const depthArrowX = packRightEdge + arrowOffset;
    
    // Labels com dimensões em cm
    const widthCm = (totalWidth / 10).toFixed(1);
    const depthCm = (totalDepth / 10).toFixed(1);

    return (
        <group>
            {cells}
            {/* Seta de comprimento (largura do pack) - horizontal na frente */}
            <DimensionArrow 
                length={packWidthUnits}
                position={[packCenterX, arrowYPosition, widthArrowZ]}
                label={`${widthCm} cm`}
            />
            {/* Seta de largura (profundidade do pack) - horizontal na lateral direita */}
            <DimensionArrow 
                length={packDepthUnits}
                position={[depthArrowX, arrowYPosition, packCenterZ]}
                rotation={[0, Math.PI / 2, 0]}
                label={`${depthCm} cm`}
            />
        </group>
    );
};

export const Battery3DViewer = ({ config }: { config: Configuration }) => {
    return (
        <div className="w-full h-[400px] bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
            <Canvas shadows dpr={[1, 2]} camera={{ fov: 50, position: [5, 5, 5] }}>
                <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
                <Center>
                    <Stage environment="city" intensity={0.6} adjustCamera>
                        <BatteryPack config={config} />
                    </Stage>
                </Center>
            </Canvas>
        </div>
    );
};