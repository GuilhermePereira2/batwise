import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, Center } from "@react-three/drei";
import type { Configuration } from "@/pages/diytool/types";

interface Cell3DProps {
    position: [number, number, number];
    width: number;
    height: number;
    thickness: number;
    type?: string;
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

    return <group>{cells}</group>;
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