from pydantic import BaseModel, EmailStr
from typing import List, Optional
# --- Component Models (minúsculas, como no teu Deno) ---


class Fuse(BaseModel):
    brand: str
    model: str
    vdc_max: float
    a_max: float
    temp_min: float
    temp_max: float
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
    temp_min: float
    temp_max: float
    price: float
    link: str


class Cable(BaseModel):
    brand: str
    model: str
    section: float
    vdc_max: float
    a_max: float
    temp_min: float
    temp_max: float
    price: float
    link: str


class Bms(BaseModel):
    brand: str
    model: str
    max_cells: int
    vdc_min: float
    vdc_max: float
    a_max: float
    temp_min: float
    temp_max: float
    master_price: float
    slave_price: float
    link: str


class Shunt(BaseModel):
    brand: str
    model: str
    vdc_max: float
    a_max: float
    temp_min: float
    temp_max: float
    price: float
    link: str

# --- Cell Data (Maiúsculas, como no teu Deno) ---


class CellData(BaseModel):
    Brand: str
    CellModelNo: str
    Composition: str
    Cell_Stack: str
    MaxContinuousDischargeRate: float
    MaxContinuousChargeRate: float
    NominalVoltage: float
    ChargeVoltage: float
    Capacity: float
    TheMaxDischargeCurrentOfTheTabs: float
    Impedance: float
    Weight: float
    Cell_Thickness: float
    Cell_Width: float
    Cell_Height: float
    TabsThickness: float
    TabsWidth: float
    TabsLength: float
    DistanceBetweenTwoTabs: float
    VolumeEnergyDensity: float
    PowerEnergyDensity: float
    Cycles: int
    Price: float
    OriginCountry: str
    Connection: str

# --- Input & Output Structures ---


class Requirements(BaseModel):
    # O frontend pode enviar strings ou números, o Pydantic converte
    min_voltage: float = 70
    max_voltage: float = 80
    min_energy: float = 3000.0  # Default valor razoável
    min_continuous_power: float = 2000.0  # Default valor razoável
    max_weight: float = 50.0  # Default valor alto
    max_price: float = 10000.0  # Default valor alto
    max_width: float = 150.0  # Default valor estreito
    max_length: float = 700.0  # Default longo valor
    max_height: float = 200.0  # Default alto valor
    ambient_temp: float = 25.0
    debug: bool = False
    include_components: bool = True


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
    # No Deno tinhas um tipo custom para cable selecionado, aqui simplificamos
    cable: Optional[Cable]
    bms: Optional[Bms]
    shunt: Optional[Shunt]
    total_price: float
    dimensions: Dimensions
    affiliate_link: str
    safety: SafetyAssessment  # Novo campo
    # Link para imagem gerada ou estática
    wiring_diagram_url: Optional[str] = None


class DesignResponse(BaseModel):
    results: List[Configuration]
    plotResults: List[Configuration]
    total: int
    stats: Optional[dict] = None
