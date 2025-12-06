from pydantic import BaseModel
from typing import List, Optional


class Requirements(BaseModel):
    min_voltage: float
    max_voltage: float
    min_energy: float
    min_continuous_power: float
    max_weight: float
    max_price: float
    max_width: float
    max_length: float
    max_height: float
    ambient_temp: float
    debug: bool = False


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


class Component(BaseModel):
    brand: str = ""
    model: str
    price: float
    link: str = ""
    # Campos opcionais para flexibilidade
    vdc_max: Optional[float] = None
    a_max: Optional[float] = None
    section: Optional[float] = None
    master_price: Optional[float] = None  # Para o BMS


class Dimensions(BaseModel):
    length: float
    width: float
    height: float


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
    fuse: Optional[Component]
    relay: Optional[Component]
    cable: Optional[Component]
    bms: Optional[Component]
    shunt: Optional[Component]
    total_price: float
    dimensions: Dimensions
    affiliate_link: str


class DesignResponse(BaseModel):
    results: List[Configuration]
    plotResults: List[Configuration]
    total: int
