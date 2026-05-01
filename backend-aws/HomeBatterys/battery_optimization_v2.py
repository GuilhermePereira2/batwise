import numpy as np
import pandas as pd
from scipy.optimize import minimize_scalar
import matplotlib.pyplot as plt


class BatteryOptimization:
    
    def __init__(self, df, type):
        # --- CONFIGURAÇÕES ---
        self.BATTERY_PRICE = None 
        self.PROJECT_YEARS = None   
        self.EFFICIENCY = 0.95      
        self.DOD_LIMIT = 0.90       
        self.INITIAL_SOC = 0.5  
        self.DISCOUNT_RATE = 0.05  # Taxa de desconto para o cálculo do valor presente líquido (VPL)

        if type == 'industrial':
            self.df_summer = pd.read_csv('../energy_prices/avg_omie_summer_2025_industrial.csv')
            self.df_winter = pd.read_csv('../energy_prices/avg_omie_winter_2025_industrial.csv')   
        elif type == 'residential':
            self.df_summer = pd.read_csv('../energy_prices/avg_omie_summer_2025_residential.csv')
            self.df_winter = pd.read_csv('../energy_prices/avg_omie_winter_2025_residential.csv')   
        else:
            raise ValueError("Invalid type. Must be 'industrial' or 'residential'.") 
        
        # Fazer para o Verão
        self.df_summer['Buy_Price_EUR_kWh'] = self.df_summer['Buy_Price_EUR_MWh'] / 1000
        self.df_summer['Sell_Price_EUR_kWh'] = self.df_summer['Sell_Price_EUR_MWh'] / 1000
        self.df_summer.set_index(['Day_of_Week', 'Hour'], inplace=True)

        # Repetir tudo de novo para o Inverno
        self.df_winter['Buy_Price_EUR_kWh'] = self.df_winter['Buy_Price_EUR_MWh'] / 1000
        self.df_winter['Sell_Price_EUR_kWh'] = self.df_winter['Sell_Price_EUR_MWh'] / 1000
        self.df_winter.set_index(['Day_of_Week', 'Hour'], inplace=True)

        # --- PROCESSAMENTO DOS DADOS (CORREÇÃO DE ERRO) ---
        print("--- Processando Dados ---")
        
        # 1. Converter para DatetimeIndex (Funciona para listas, arrays e series)
        # O erro anterior foi resolvido aqui usando pd.DatetimeIndex direto
        raw_ts = pd.DatetimeIndex(df["Timestamp"])
        
        # 2. Remover Fuso Horário (Forçar Hora Local)
        # Se os dados têm fuso (ex: +01:00), removemos a informação mantendo a hora numérica
        # ou convertemos para 'None' (UTC) se for o padrão.
        if raw_ts.tz is not None:
             self.timestamps = raw_ts.tz_convert(None)
        else:
             self.timestamps = raw_ts

        # 3. Garantir dados numéricos
        self.load = df["P_load_inst_kW"].fillna(0).values
        self.pv_gen = df["P_pv_inst_kW"].fillna(0).values

        # 4. Calcular Delta T (Horas)
        time_diff = np.diff(self.timestamps) / np.timedelta64(1, 'h')
        # Proteção: Se diff for zero ou negativo (dados duplicados), forçamos um valor mínimo
        time_diff = np.where(time_diff <= 0, 0.25, time_diff) 
        self.dt = np.append(time_diff, time_diff[-1])
        #print(f"Delta T calculado: {self.dt[:10]}...  Max: {self.dt.max()} h, Min: {self.dt.min()} h")

        start = self.timestamps.min()
        end = self.timestamps.max()
        duration = end - start
        self.years = duration / pd.Timedelta(days=365.25)   # approximate years
        if self.years < 0.01: self.years = 0.01
        
        #print(f"Dados processados com sucesso: {len(self.load)} linhas.")
    

    def simulation(self, capacity_kwh, chem, cells_df):
        usable_cap = capacity_kwh * self.DOD_LIMIT
        soc = usable_cap * self.INITIAL_SOC
        
        # --- Aliases locais ---
        load = self.load
        pv = self.pv_gen
        timestamps = self.timestamps
        dt = self.dt
        eff_sqrt = np.sqrt(self.EFFICIENCY)
        
        total_grid_cost = 0.0
        total_grid_revenue = 0.0
        
        # CORREÇÃO 1: Usar arrays do NumPy em vez de dicionários
        bat_power = np.zeros(len(timestamps))
        bat_soc = np.zeros(len(timestamps))
        grid_power = np.zeros(len(timestamps))
        
        for i, t in enumerate(timestamps):
            net = load[i] - pv[i]
            energy = abs(net) * dt[i] # Potência (kW) * Tempo (h) = Energia (kWh)
            
            if net < 0: # Sobra
                max_ch = energy * eff_sqrt
                space = usable_cap - soc
                if space <= 0:
                    to_grid = energy
                    to_batt = 0
                elif max_ch <= space:
                    to_batt = max_ch
                    to_grid = energy - (to_batt / eff_sqrt)
                else:
                    to_batt = space
                    to_grid = energy - (to_batt / eff_sqrt)
                    
                
                total_grid_revenue += to_grid * self.get_sell_price(t)
                soc += to_batt
                
                # Guardar dados nos arrays (usando o índice 'i')
                bat_power[i] = to_batt / dt[i]  # Potência de carga em kW
                grid_power[i] = -to_grid / dt[i]  # Potência vendida à rede em kW
                
            else: # Falta
                needed = energy
                avail = soc * eff_sqrt
                
                if avail >= needed:
                    soc -= needed / eff_sqrt
                    from_batt = needed
                    from_grid = 0
                else:
                    soc = 0
                    from_batt = avail
                    from_grid = needed - avail
                    total_grid_cost += from_grid * self.get_buy_price(t)

                # CORREÇÃO 2: Dividir por dt[i] para garantir que é Potência (kW) e não Energia
                bat_power[i] = -from_batt / dt[i] 
                grid_power[i] = from_grid / dt[i]
            
            
            bat_soc[i] = soc / capacity_kwh
        
        
        CF = -((total_grid_revenue-total_grid_cost) / self.years)  # Custo da rede projetado
        capex = capacity_kwh * self.BATTERY_PRICE # Custo de investimento
        CF_cumulative = 0
        
        
        lifetime_years, debug_info = calculate_lifetime(bat_soc, bat_power, np.average(dt), capacity_kwh, chem, cells_df)
        #lifetime_years = 10  # Garantir que seja pelo menos 0.01 anos para evitar problemas de divisão por zero

        for i in range(1, int(lifetime_years) + 1):
            CF_cumulative += CF * (1 + self.DISCOUNT_RATE)**(-i)

        return capex, CF, total_grid_cost/self.years, total_grid_revenue/self.years, CF_cumulative, lifetime_years, bat_soc, bat_power, grid_power, debug_info

    
    
    def run(self,chem,cells_df):
        print("Iniciando Otimização...")
        try:
            # 1. Definimos a função objetivo
            def objective_function(x):
                capex, CF, total_grid_cost, total_grid_revenue, CF_cumulative, lifetime_years, bat_soc, bat_power, grid_power, debug_info = self.simulation(x, chem, cells_df)
                return capex + CF_cumulative  # CAPEX + OPEX acumulado (CF_cumulative)

            # 2. CORREÇÃO CRÍTICA: bounds começa em 0.001 em vez de 0 para evitar divisão por zero!
            res = minimize_scalar(objective_function, bounds=(0.1, 10), method='bounded')
            
            # 3. Calculamos os valores finais para o resultado ótimo
            capex, CF, total_grid_cost, total_grid_revenue, CF_cumulative, lifetime_years, bat_soc, bat_power, grid_power, debug_info = self.simulation(res.x,chem,cells_df) 

            # 4. Mostrar os resultados e o gráfico apenas se tiver sucesso
            if res.success:
                print(f"\n--- SUCESSO ---")
                print(f"Optimal Energy: {res.x:.2f} kWh")
                print(f"Estimated Lifetime: {lifetime_years:.2f} years")
                print(f"Total Cost: {res.fun:.2f} €")
                print(f"CF (Energy Cost per Year): {CF:.2f} € (custo da energia comprada - receita da energia vendida)")
                print(f"Capex (Battery Cost): {capex:.2f} € (custo de investimento na bateria)")
                print(f"Total Grid Cost per Year: {total_grid_cost:.2f} € (custo anual de energia comprada à rede)")
                print(f"Total Grid Revenue per Year: {total_grid_revenue:.2f} € (receita anual de energia vendida à rede)")
                
                # Plot (usando os 3 argumentos exigidos pela função simulation)
                x = np.linspace(0.1, res.x*2, 20)
                res_ = [self.simulation(i, chem, cells_df) for i in x]
                y = [r[0] + r[4] for r in res_]
                plt.figure(figsize=(10,5))
                plt.plot(x, y, label="Total Cost")
                plt.axvline(res.x, color='r', linestyle='--', label=
                f"Optimal Energy: {res.x:.1f} kWh\n"
                f"Optimal Cost: {res.fun:.2f} €\n"
                f"Capex: {capex:.2f} €\n"
                f"CF: {CF:.2f} €")
                plt.xlabel("Energy (kWh)")
                plt.ylabel("Cost (€)")
                plt.legend()
                plt.show()
            else:
                print(f"Otimização falhou: {res.message}")

            # 5. O RETURN TEM DE ESTAR AQUI (no final do try, para ser sempre executado em caso de sucesso)
            return res, capex, CF, total_grid_cost, total_grid_revenue, CF_cumulative
            
        except Exception as e:
            # 1. Importar a biblioteca de traceback
            import traceback 
            
            print(f"\n--- ERRO DETALHADO PARA {chem} ---")
            # 2. Imprimir o caminho completo do erro
            traceback.print_exc() 
            print("-----------------------------------\n")
            # 6. CORREÇÃO CRÍTICA: Se der erro, devolvemos valores neutros para o código não estourar no unpacking
            from types import SimpleNamespace
            res_fail = SimpleNamespace(x=0.001, fun=np.nan, success=False)
            return res_fail, 0.0, 0.0, 0.0, 0.0, 0.0, {}

    def get_buy_price(self, dt: pd.Timestamp) -> float:
        """Recebe um Datetime (de qualquer ano) e devolve o preço de COMPRA em €/kWh."""
        day_name = dt.day_name()
        hour_omie = dt.hour + 1  # Pandas é 0-23, OMIE é 1-24
        
        # Verifica se a data cai no período de Verão (21 Junho a 22 Setembro)
        is_summer = (6, 21) <= (dt.month, dt.day) <= (9, 22)
        
        if is_summer:
            return self.df_summer.loc[(day_name, hour_omie), 'Buy_Price_EUR_kWh']
        else:
            return self.df_winter.loc[(day_name, hour_omie), 'Buy_Price_EUR_kWh']
    
    def get_sell_price(self, dt: pd.Timestamp) -> float:
        """Recebe um Datetime (de qualquer ano) e devolve o preço de VENDA em €/kWh."""
        day_name = dt.day_name()
        hour_omie = dt.hour + 1
        
        is_summer = (6, 21) <= (dt.month, dt.day) <= (9, 22)
        
        if is_summer:
            return self.df_summer.loc[(day_name, hour_omie), 'Sell_Price_EUR_kWh']
        else:
            return self.df_winter.loc[(day_name, hour_omie), 'Sell_Price_EUR_kWh']
        
    def no_battery_cost(self):
        total_grid_cost = 0.0
        total_grid_revenue = 0.0
        
        for i, t in enumerate(self.timestamps):
            net = self.load[i] - self.pv_gen[i]
            energy = abs(net) * self.dt[i]
            
            if net < 0: # Sobra (Vender à rede)
                total_grid_revenue += energy * self.get_sell_price(t)
            else: # Falta (Comprar à rede)
                total_grid_cost += energy * self.get_buy_price(t)
        
        CF = -((total_grid_revenue-total_grid_cost) / self.years)  # Custo da rede projetado
        
        return CF, total_grid_cost/self.years, total_grid_revenue/self.years  # Custo anual sem bateria
    
def calculate_lifetime(bat_soc, bat_power, avg_dt, total_capacity_kwh, chem, cells_df):
        from main_v3 import compute_damage_paper
        
        # 1. Create a 1-row DataFrame, keeping the original index
        bat_df = cells_df[cells_df['Composition'] == chem].copy()
        
        # 2. Update dynamic variables
        idx = bat_df.index[0] 
        bat_df.loc[idx, 'n_cells'] = total_capacity_kwh / bat_df.loc[idx, 'E_cell_Wh']
        bat_df.loc[idx, 'P_dis_max'] = bat_df.loc[idx, 'MaxContinuousDischargeRate'] * total_capacity_kwh
        bat_df.loc[idx, 'P_ch_max'] = bat_df.loc[idx, 'MaxContinuousChargeRate'] * total_capacity_kwh 
        bat_df.loc[idx, 'E_total_Wh'] = total_capacity_kwh * 1000
        
        # 3. Use raw Numpy Arrays inside the wrapper!
        # bat_power and bat_soc are ALREADY numpy arrays in your simulation loop. 
        # We just wrap them directly.
        
        P_batt_multi = {chem: bat_power}
        
        # We multiply by 100 here so main_v3.py dividing by 100 puts it back to 0-1 scale safely
        SOC_P_hist_multi = {chem: bat_soc * 100} 
        
        # 4. Calculate degradation
        NC, NC_total, Nc_chem, years, avg_nc, debug_info = compute_damage_paper(P_batt_multi, bat_df, avg_dt, SOC_P_hist_multi)

        debug_info = {
            "NC": NC,
            "NC_total": NC_total,
            "Nc_chem": Nc_chem,
            "Years": years,
            "Avg_NC": avg_nc,
            "damage_debug_info": debug_info
        }

        #print(f"Degradação para {chem}: NC_total={NC_total[chem]:.4f}, Nc_ref={bat_df.loc[idx, 'Cycles']:.4f}")
        #print(f"Degradação calculada para {chem}: {years:.2f} anos de vida útil estimada (Battery: {total_capacity_kwh:.2f} kWh).")
        return years, debug_info