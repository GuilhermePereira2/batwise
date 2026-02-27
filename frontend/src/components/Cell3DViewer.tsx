import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, Center, Html } from "@react-three/drei";

interface DimensionArrowProps {
    length: number;
    position: [number, number, number];
    rotation?: [number, number, number];
    label: string;
}

const DimensionArrow = ({ length, position, rotation = [0, 0, 0], label }: DimensionArrowProps) => {
    const arrowSize = 0.3;
    
    return (
        <group position={position} rotation={rotation}>
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[length, 0.08, 0.08]} />
                <meshStandardMaterial color="#f46a25" />
            </mesh>
            
            <mesh position={[-length / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <coneGeometry args={[arrowSize, arrowSize * 1.5, 4]} />
                <meshStandardMaterial color="#f46a25" />
            </mesh>
            
            <mesh position={[length / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[arrowSize, arrowSize * 1.5, 4]} />
                <meshStandardMaterial color="#f46a25" />
            </mesh>
            
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

interface Cell3DViewerProps {
    width: number;      // mm
    height: number;     // mm
    thickness: number;  // mm
    arrowOffset?: number; // Offset das setas (padrão: 1.0 para células individuais)
}

const SingleCell = ({ width, height, thickness, arrowOffset = 1.0 }: Cell3DViewerProps) => {
    // Se largura ~ espessura (+- 2mm), assumimos cilíndrica
    const isCylindrical = Math.abs(width - thickness) < 2;

    // Escala: 1 unidade 3D = 10mm
    const scale = 0.1;
    const w = width * scale;
    const h = height * scale;
    const t = thickness * scale;

    // Posição Y para as setas
    const arrowYPosition = 0.0;

    return (
        <group>
            {/* Célula */}
            {isCylindrical ? (
                <mesh position={[0, h / 2, 0]}>
                    <cylinderGeometry args={[w / 2, w / 2, h, 32]} />
                    <meshStandardMaterial color="#3b82f6" roughness={0.3} metalness={0.8} />
                </mesh>
            ) : (
                <mesh position={[0, h / 2, 0]}>
                    <boxGeometry args={[w, h, t]} />
                    <meshStandardMaterial color="#3b82f6" roughness={0.2} metalness={0.5} />
                </mesh>
            )}

            {/* Setas de dimensão */}
            {isCylindrical ? (
                <>
                    {/* Altura - vertical à direita */}
                    <DimensionArrow 
                        length={h}
                        position={[w / 2 + arrowOffset, h / 2, 0]}
                        rotation={[0, 0, Math.PI / 2]}
                        label={`${height} mm`}
                    />
                    {/* Diâmetro - horizontal na frente */}
                    <DimensionArrow 
                        length={w}
                        position={[0, arrowYPosition, w / 2 + arrowOffset]}
                        label={`Ø ${width} mm`}
                    />
                </>
            ) : (
                <>
                    {/* Largura - horizontal na frente */}
                    <DimensionArrow 
                        length={w}
                        position={[0, arrowYPosition, t / 2 + arrowOffset]}
                        label={`${width} mm`}
                    />
                    {/* Espessura - horizontal na lateral */}
                    <DimensionArrow 
                        length={t}
                        position={[w / 2 + arrowOffset, arrowYPosition, 0]}
                        rotation={[0, Math.PI / 2, 0]}
                        label={`${thickness} mm`}
                    />
                    {/* Altura - vertical à direita atrás */}
                    <DimensionArrow 
                        length={h}
                        position={[w / 2 + arrowOffset, h / 2, t / 2 + arrowOffset]}
                        rotation={[0, 0, Math.PI / 2]}
                        label={`${height} mm`}
                    />
                </>
            )}
        </group>
    );
};

export const Cell3DViewer = ({ width, height, thickness, arrowOffset = 1.0 }: Cell3DViewerProps) => {
    return (
        <div className="w-full h-[500px] bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
            <Canvas shadows dpr={[1, 2]} camera={{ fov: 50, position: [8, 8, 8] }}>
                <OrbitControls makeDefault autoRotate autoRotateSpeed={1.5} />
                <Center>
                    <Stage environment="city" intensity={0.6} adjustCamera>
                        <SingleCell width={width} height={height} thickness={thickness} arrowOffset={arrowOffset} />
                    </Stage>
                </Center>
            </Canvas>
        </div>
    );
};
