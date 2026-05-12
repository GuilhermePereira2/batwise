from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from typing import List, Optional, Any, Tuple
# --- Component Models (minúsculas, como no teu Deno) ---


class Fuse(BaseModel):
    brand: str
    model: str
    vdc_max: float
    a_max: float
    temp_min: Optional[float] = None  # Alterado para opcional
    temp_max: Optional[float] = None  # Alterado para opcional
    price: float
    link: str


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    message: str


class Relay(BaseModel):
    brand: str
    model: str
    vdc_max: float
    a_max: float
    temp_min: Optional[float] = None  # Alterado para opcional
    temp_max: Optional[float] = None  # Alterado para opcional
    price: float
    link: str


class Cable(BaseModel):
    brand: str
    model: str
    section: float
    vdc_max: float
    a_max: float
    temp_min: Optional[float] = None  # Alterado para opcional
    temp_max: Optional[float] = None  # Alterado para opcional
    price: float
    link: str


class Bms(BaseModel):
    brand: str
    model: str
    max_cells: int
    vdc_min: float
    vdc_max: float
    a_max: float
    temp_min: Optional[float] = None  # Alterado para opcional
    temp_max: Optional[float] = None  # Alterado para opcional
    master_price: float
    slave_price: float
    link: str


class Shunt(BaseModel):
    brand: str
    model: str
    vdc_max: float
    a_max: float
    temp_min: Optional[float] = None  # Alterado para opcional
    temp_max: Optional[float] = None  # Alterado para opcional
    price: float
    link: str

# --- Cell Data (Maiúsculas, como no teu Deno) ---


class CellData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    # Identificadores (CellModelNo é o único estritamente obrigatório)
    CellModelNo: str
    Brand: str
    Composition: str = "Li-ion"
    Cell_Stack: str = "Unknown"
    OriginCountry: str = "Unknown"
    Connection: str = "Solder"

    # Dados Elétricos (Defaults a 0.0 para não partir se faltar no CSV)
    NominalVoltage: float
    ChargeVoltage: float
    Capacity: float
    MaxContinuousDischargeRate: float
    MaxContinuousChargeRate: float
    TheMaxDischargeCurrentOfTheTabs: float = 1
    Impedance: float = 0.0
    Cycles: float = 0.0

    # Dados Físicos
    Weight: float
    Cell_Thickness: float
    Cell_Width: float
    Cell_Height: float

    # Tabs (Geralmente faltam em CSVs simples, assumimos 0)
    TabsThickness: float = 0.0
    TabsWidth: float = 0.0
    TabsLength: float = 0.0
    DistanceBetweenTwoTabs: float = 0.0

    # Densidades (Calculadas automaticamente se faltarem)
    VolumeEnergyDensity: float = 0.0
    PowerEnergyDensity: float = 0.0

    # Comercial
    Price: float = 0.0

    @model_validator(mode='before')
    @classmethod
    def calculate_missing_metrics(cls, data: Any) -> Any:
        """
        Se o CSV não tiver campos de densidade, calculamo-los aqui 'instantly'.
        Também limpa campos vazios que possam vir como strings.
        """
        if not isinstance(data, dict):
            return data

        # Helper para sacar floats do dicionário de forma segura
        def get_f(key, default=0.0):
            val = data.get(key, default)
            try:
                if isinstance(val, str) and val.strip() == "":
                    return default
                return float(val)
            except (ValueError, TypeError):
                return default

        # 1. Garantir que campos críticos existem como números (para a lógica não falhar)
        # Se vierem strings vazias do CSV, isto converte para 0.0
        keys_to_clean = [
            'NominalVoltage', 'Capacity', 'MaxContinuousDischargeRate',
            'Cell_Height', 'Cell_Width', 'Cell_Thickness', 'Weight', 'Price'
        ]
        for k in keys_to_clean:
            if k in data:
                data[k] = get_f(k)

        # 2. Cálculo Automático de Densidades
        h = get_f('Cell_Height')
        w = get_f('Cell_Width')
        t = get_f('Cell_Thickness')

        # Volume em Litros (mm^3 / 1e6)
        volume_l = (h * w * t) / 1_000_000

        # Só calculamos se a célula tiver dimensões válidas
        if volume_l > 0:
            capacity_ah = get_f('Capacity') / 1000
            voltage = get_f('NominalVoltage')
            c_rate = get_f('MaxContinuousDischargeRate')

            energy_wh = capacity_ah * voltage
            power_w = energy_wh * c_rate  # Potência nominal

            # Se 'VolumeEnergyDensity' não existir ou for 0, calcula
            if not data.get('VolumeEnergyDensity'):
                data['VolumeEnergyDensity'] = round(energy_wh / volume_l, 2)

            # Se 'PowerEnergyDensity' não existir ou for 0, calcula
            if not data.get('PowerEnergyDensity'):
                data['PowerEnergyDensity'] = round(power_w / volume_l, 2)

        return data

# --- Input & Output Structures ---


class Requirements(BaseModel):
    # Campos obrigatórios (sem Optional, sem default)
    min_voltage: float
    max_voltage: float
    min_energy: float
    min_continuous_power: float

    # Campos com defaults (tecnicamente obrigatórios mas sempre enviados pelo frontend)
    debug: bool = True
    include_components: bool = True
    use_custom_db: bool = False

    # Campos opcionais (com Optional e default None ou valor padrão)
    peak_power: Optional[float] = None
    max_weight: Optional[float] = None
    max_price: Optional[float] = None
    max_width: Optional[float] = None
    max_length: Optional[float] = None
    max_height: Optional[float] = None
    ambient_temp: float = 25.0  # Opcional com default de 25°C


class Dimensions(BaseModel):
    length: float
    width: float
    height: float


class SafetyAssessment(BaseModel):
    is_safe: bool
    safety_score: int  # 0 a 100
    warnings: List[str]  # Ex: "Current implies high heat generation"
    recommendations: List[str]  # Ex: "Use Active Cooling"

# Esta estrutura espelha exatamente a interface Configuration do TypeScript


class Configuration(BaseModel):
    cell: CellData
    series_cells: int
    parallel_cells: int
    battery_voltage: float
    battery_capacity: float
    battery_energy: float
    battery_weight: float
    battery_impedance: float
    continuous_power: float
    peak_power: float
    cell_price: float
    fuse: Optional[Fuse]
    relay: Optional[Relay]
    cable: Optional[Cable]
    bms: Optional[Bms]
    shunt: Optional[Shunt]
    total_price: float
    dimensions: Dimensions
    affiliate_link: str
    safety: SafetyAssessment
    layout: Optional[Tuple[int, int]] = None
    wiring_diagram_url: Optional[str] = None


class DesignResponse(BaseModel):
    results: List[Configuration]
    plotResults: List[Configuration]
    total: int
    stats: Optional[dict] = None
    remaining_credits: Optional[int] = None


class UserCreate(BaseModel):
    full_name: str
    company: Optional[str] = None
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class GoogleLogin(BaseModel):
    credential: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user_name: str
    email: Optional[EmailStr] = None
    credits: int
    trial_started_at: Optional[str] = None
    admin: bool = False


class UserResponse(BaseModel):
    email: EmailStr
    full_name: str
    credits: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    trial_started_at: Optional[str] = None
    is_verified: bool = False
    admin: bool = False

    class Config:
        from_attributes = True


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    token: str
    new_password: str


class SimulatorRequest(BaseModel):
    mode: str  # 'house' | 'bill'
    input: dict
    tariff: dict
    assumptions: dict
    solar: Optional[dict] = None
    max_investment: Optional[float] = None
