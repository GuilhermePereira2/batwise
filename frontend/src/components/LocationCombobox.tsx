import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const COUNTRIES = [
    { value: "Portugal", label: "Portugal" },
    { value: "Espanha", label: "Espanha" },
];

interface LocationComboboxProps {
    type: 'country' | 'postcode' | 'locality';
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    country?: string;
    concelho?: string; // This will now represent the zip code internally
}

export function LocationCombobox({
    type,
    value,
    onChange,
    placeholder,
    country,
    concelho,
}: LocationComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [searchValue, setSearchValue] = React.useState("");
    const [options, setOptions] = React.useState<{ value: string; label: string }[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const validatePostcode = (postcode: string, countryName: string) => {
        if (!postcode) return true;
        if (countryName === 'Portugal') {
            return /^\d{4}-\d{3}$/.test(postcode) || /^\d{7}$/.test(postcode) || /^\d{4}$/.test(postcode);
        }
        if (countryName === 'Espanha') {
            return /^\d{5}$/.test(postcode);
        }
        return true;
    };

    // Initial options for country
    React.useEffect(() => {
        if (type === 'country') {
            setOptions(COUNTRIES);
        }
    }, [type]);

    // Fetch options from Mapbox for postcode and locality
    React.useEffect(() => {
        if (type === 'country' || !MAPBOX_TOKEN) {
            if (type === 'country') setOptions(COUNTRIES);
            else setOptions([]);
            return;
        }

        const fetchOptions = async () => {
            setLoading(true);
            setError(null);
            try {
                const types = type === 'postcode' ? 'postcode' : 'locality';
                const countryCode = country ? getCountryCode(country) : 'pt';
                const proximity = `&country=${countryCode}`;
                
                let query = searchValue;
                if (!query) {
                    if (type === 'locality' && concelho) {
                        query = concelho + (country ? `, ${country}` : '');
                    } else if (country) {
                        query = country;
                    } else {
                        query = countryCode === 'pt' ? 'Portugal' : 'Espanha';
                    }
                } else {
                    if (type === 'locality' && concelho) {
                        query += `, ${concelho}`;
                    }
                    if (country) {
                        query += `, ${country}`;
                    }
                }
                
                const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&types=${types}&language=pt&limit=10${proximity}`;
                
                const response = await fetch(url);
                const data = await response.json();
                
                if (type === 'postcode' && searchValue && data.features.length === 0) {
                    setError("Código postal não encontrado ou inválido.");
                }

                const newOptions = data.features.map((f: any) => {
                    let label = f.place_name;
                    if (country) label = label.replace(new RegExp(`, ${country}$`, 'i'), '');
                    
                    return {
                        value: f.text,
                        label: label,
                    };
                });

                // Remove duplicates
                const uniqueOptions = newOptions.filter((opt: any, index: number, self: any) =>
                    index === self.findIndex((t: any) => t.value === opt.value)
                );

                setOptions(uniqueOptions);
            } catch (error) {
                console.error("Error fetching locations:", error);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchOptions, searchValue ? 300 : 0);
        return () => clearTimeout(timeoutId);
    }, [searchValue, type, country, concelho]);

    const getCountryCode = (countryName: string) => {
        const codes: Record<string, string> = {
            "Portugal": "pt",
            "Espanha": "es",
            "Brasil": "br",
            "França": "fr",
            "Alemanha": "de",
            "Reino Unido": "gb",
            "Itália": "it",
            "Estados Unidos": "us",
        };
        return codes[countryName] || '';
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className="flex flex-col gap-1 w-full">
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between h-12 bg-white border-gray-200 text-gray-900 rounded-xl hover:bg-gray-50 focus:ring-2 focus:ring-orange-600 transition-all",
                            !value && "text-gray-400"
                        )}
                    >
                        {loading && options.length === 0 ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                                <span>A carregar...</span>
                            </div>
                        ) : (
                            value ? options.find((opt) => opt.value === value)?.label || value : placeholder
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                {error && <p className="text-[10px] font-bold text-orange-600 px-1">{error}</p>}
            </div>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-white border-gray-200 shadow-xl rounded-xl">
                <Command shouldFilter={type === 'country'}>
                    <CommandInput 
                        placeholder={`Pesquisar ${placeholder?.toLowerCase()}...`} 
                        value={searchValue}
                        onValueChange={setSearchValue}
                    />
                    <CommandList>
                        {loading && (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                            </div>
                        )}
                        {!loading && options.length === 0 && (
                            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                        )}
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.value}
                                    onSelect={(currentValue) => {
                                        onChange(currentValue === value ? "" : currentValue);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                            {type !== 'country' && searchValue && !loading && !options.some(o => o.value.toLowerCase() === searchValue.toLowerCase()) && (
                                <CommandItem
                                    value={searchValue}
                                    onSelect={(currentValue) => {
                                        onChange(currentValue);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className="mr-2 h-4 w-4 opacity-0" />
                                    Usar "{searchValue}"
                                </CommandItem>
                            )}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
