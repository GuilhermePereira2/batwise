import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { CheckCircle2, MapPin, PencilLine, RefreshCw, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

type RoofPolygonFeature = {
    type: 'Feature';
    properties: Record<string, unknown>;
    geometry: {
        type: 'Polygon';
        coordinates: number[][][];
    };
};

export type RoofMapValue = {
    enabled: boolean;
    address: string;
    center: { lng: number; lat: number } | null;
    polygon: RoofPolygonFeature | null;
    area_m2: number;
    provider: 'mapbox';
};

type SearchResult = {
    id: string;
    place_name: string;
    center: [number, number];
};

type RoofMapPickerProps = {
    value: RoofMapValue;
    onChange: (value: RoofMapValue) => void;
    defaultQuery?: string;
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const defaultCenter: [number, number] = [-9.1393, 38.7223];
// Ajuste estes valores para controlar o zoom inicial do mapa.
const DEFAULT_MAP_ZOOM = 11; // Zoom mais amplo para mostrar a cidade inteira
const LOCATION_MAP_ZOOM = 14; // Zoom mais próximo para focar na localização encontrada ou salva
const SAVED_ROOF_MAP_ZOOM = 17; // Zoom ainda mais próximo para focar no telhado salvo, se houver

const getPolygonArea = (feature: RoofPolygonFeature | null) => {
    const ring = feature?.geometry?.coordinates?.[0];
    if (!ring || ring.length < 4) return 0;

    const meanLat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
    const metersPerDegreeLng = 111320 * Math.cos((meanLat * Math.PI) / 180);
    const metersPerDegreeLat = 110540;

    const points = ring.map(([lng, lat]) => ({
        x: lng * metersPerDegreeLng,
        y: lat * metersPerDegreeLat,
    }));

    const area = points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length];
        return sum + point.x * next.y - next.x * point.y;
    }, 0);

    return Math.round(Math.abs(area) / 2);
};

export default function RoofMapPicker({ value, onChange, defaultQuery = '' }: RoofMapPickerProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const drawRef = useRef<MapboxDraw | null>(null);
    const valueRef = useRef(value);
    const onChangeRef = useRef(onChange);
    const lastAutoQueryRef = useRef('');
    const [isLocating, setIsLocating] = useState(false);
    const [locationError, setLocationError] = useState('');

    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        if (!value.enabled || !MAPBOX_TOKEN || !mapContainerRef.current || mapRef.current) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;
        const center: [number, number] = value.center ? [value.center.lng, value.center.lat] : defaultCenter;
        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/satellite-streets-v12',
            center,
            zoom: value.center ? SAVED_ROOF_MAP_ZOOM : DEFAULT_MAP_ZOOM,
            pitch: 0,
        });

        const draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: {
                polygon: true,
                trash: true,
            },
            defaultMode: 'draw_polygon',
        });

        map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right');
        map.addControl(draw, 'top-left');

        const updatePolygon = () => {
            const polygon = draw.getAll().features.find((feature) => feature.geometry.type === 'Polygon') as RoofPolygonFeature | undefined;
            const nextPolygon = polygon || null;
            onChangeRef.current({
                ...valueRef.current,
                polygon: nextPolygon,
                area_m2: getPolygonArea(nextPolygon),
            });
        };

        map.on('draw.create', updatePolygon);
        map.on('draw.update', updatePolygon);
        map.on('draw.delete', updatePolygon);

        map.on('load', () => {
            if (valueRef.current.polygon) {
                draw.add(valueRef.current.polygon);
                draw.changeMode('simple_select');
            }
        });

        mapRef.current = map;
        drawRef.current = draw;

        return () => {
            map.remove();
            mapRef.current = null;
            drawRef.current = null;
        };
    }, [value.enabled]);

    const updateValue = (next: Partial<RoofMapValue>) => {
        onChangeRef.current({ ...valueRef.current, ...next });
    };

    const fetchAddressResults = async (searchText: string, limit: number) => {
        const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchText)}.json`;
        const params = new URLSearchParams({
            access_token: MAPBOX_TOKEN,
            autocomplete: 'true',
            language: 'pt',
            limit: String(limit),
            types: 'address,place,postcode,locality,neighborhood',
        });
        const response = await fetch(`${endpoint}?${params.toString()}`);
        if (!response.ok) throw new Error('Não foi possível pesquisar a morada.');
        const data = await response.json();
        return (data.features || []) as SearchResult[];
    };

    const centerMapFromLocation = async (searchText: string) => {
        const nextQuery = searchText.trim();
        if (!nextQuery || !MAPBOX_TOKEN) return;

        setIsLocating(true);
        setLocationError('');

        try {
            const [result] = await fetchAddressResults(nextQuery, 1);
            if (!result) {
                setLocationError('Não encontrámos esta localização. Ajuste País, Cidade ou Localidade acima.');
                return;
            }

            const [lng, lat] = result.center;
            updateValue({
                address: result.place_name || nextQuery,
                center: { lng, lat },
            });
            mapRef.current?.flyTo({
                center: [lng, lat],
                zoom: LOCATION_MAP_ZOOM,
                essential: true,
            });
            drawRef.current?.changeMode('draw_polygon');
        } catch (error) {
            console.error('Erro ao centrar mapa na localização:', error);
            setLocationError('Erro ao centrar o mapa. Tente novamente.');
        } finally {
            setIsLocating(false);
        }
    };

    useEffect(() => {
        const initialQuery = defaultQuery.trim();
        if (!value.enabled || !MAPBOX_TOKEN || !initialQuery || value.polygon) return;
        if (lastAutoQueryRef.current === initialQuery) return;

        lastAutoQueryRef.current = initialQuery;

        let cancelled = false;
        const timeout = window.setTimeout(async () => {
            try {
                const [result] = await fetchAddressResults(initialQuery, 1);
                if (cancelled || !result) return;

                const [lng, lat] = result.center;
                updateValue({
                    address: result.place_name || initialQuery,
                    center: { lng, lat },
                });
                mapRef.current?.flyTo({
                    center: [lng, lat],
                    zoom: LOCATION_MAP_ZOOM,
                    essential: true,
                });
            } catch (error) {
                console.error('Erro ao centrar mapa na localização inicial:', error);
            }
        }, 400);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [defaultQuery, value.enabled, value.center, value.address, value.polygon]);

    const clearPolygon = () => {
        drawRef.current?.deleteAll();
        updateValue({ polygon: null, area_m2: 0 });
        drawRef.current?.changeMode('draw_polygon');
    };

    return (
        <div className="pt-4 border-t border-gray-200 space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Label className="mb-1 text-base font-bold">Pretende inserir exatamente o telhado da sua casa no mapa?</Label>
                    <p className="text-sm text-gray-500">Pode desenhar um polígono 2D sobre imagem de satélite para guardar a área real do telhado.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:w-auto">
                    <Button
                        className={`h-12 ${value.enabled ? 'bg-white border border-gray-200 text-black hover:bg-gray-100' : 'bg-orange-600 text-white hover:bg-orange-700'}`}
                        onClick={() => updateValue({ enabled: false })}
                    >
                        Não
                    </Button>
                    <Button
                        className={`h-12 ${value.enabled ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border border-gray-200 text-black hover:bg-gray-100'}`}
                        onClick={() => updateValue({ enabled: true })}
                    >
                        Sim
                    </Button>
                </div>
            </div>

            {value.enabled && (
                <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    {!MAPBOX_TOKEN ? (
                        <Alert className="bg-amber-50 border-amber-200 text-amber-900">
                            <MapPin className="h-5 w-5 text-amber-600" />
                            <AlertTitle>Mapa por configurar</AlertTitle>
                            <AlertDescription>
                                Defina a variável <span className="font-mono">VITE_MAPBOX_TOKEN</span> para ativar pesquisa de morada, satélite e desenho do telhado.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium text-gray-900">Localização usada:</span>{' '}
                                    {defaultQuery || 'Preencha País, Cidade e Localidade acima.'}
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button
                                        type="button"
                                        className="h-10 bg-black text-white hover:bg-gray-800"
                                        onClick={() => centerMapFromLocation(defaultQuery)}
                                        disabled={isLocating || !defaultQuery.trim()}
                                    >
                                        <RefreshCw className={`mr-2 h-4 w-4 ${isLocating ? 'animate-spin' : ''}`} />
                                        {isLocating ? 'A centrar...' : 'Centrar pela localização'}
                                    </Button>
                                    <Button type="button" variant="outline" className="h-10 border-gray-300 text-black hover:bg-gray-100" onClick={clearPolygon}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Limpar polígono
                                    </Button>
                                </div>
                            </div>

                            {locationError && <p className="text-sm font-medium text-orange-700">{locationError}</p>}

                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                                <div ref={mapContainerRef} className="h-[460px] w-full" />
                            </div>

                            <div className="flex flex-col gap-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2">
                                    <PencilLine className="h-4 w-4 text-orange-600" />
                                    Clique nos cantos do telhado e feche o polígono no primeiro ponto.
                                </div>
                                {value.polygon ? (
                                    <Badge className="w-fit bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                        Telhado guardado: {value.area_m2} m²
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="w-fit border-gray-300 text-gray-600">
                                        Sem polígono selecionado
                                    </Badge>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
