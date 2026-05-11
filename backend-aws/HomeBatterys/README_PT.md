# HomeBatterys

Esta pasta contém o motor de dimensionamento e recomendação de baterias domésticas usado pelo endpoint do simulador em `backend-aws/main.py`.

O ponto de entrada público é:

```python
from HomeBatterys.optimizer import optimize_home_battery
```

## Fluxo

1. `optimizer.py` recebe o payload do frontend.
2. `profile.py` converte os dados da casa, factura e solar num ano horário sintético.
3. `tariffs.py` expande a tarifa para preços horários.
4. `simulation.py` simula a carga/descarga da bateria para várias capacidades candidatas.
5. `recommendations.py` transforma a capacidade escolhida em recomendações reais de catálogo: baterias, inversores e painéis solares.
6. A resposta devolve resumo, curva de capacidade e 3 recomendações por categoria: Budget, Balanced e Premium.

## Ficheiros

- `optimizer.py`
  Orquestra o cálculo completo. É o módulo importado pela API. Constrói o perfil, executa as simulações de capacidade, escolhe a capacidade alvo e chama o ranking do catálogo.

- `profile.py`
  Constrói o perfil horário sintético de consumo e produção fotovoltaica. Inclui o estimador de consumo da casa, pressupostos de carregamento EV, estimativas de produção solar e estimativa de área de telhado.

- `simulation.py`
  Simula a carga e descarga da bateria ao longo do perfil horário. Também constrói a curva de capacidades candidatas e escolhe a capacidade técnica.

- `recommendations.py`
  Converte a capacidade ideal em recomendações de catálogo. Trata variantes de baterias em paralelo, selecção de inversor, dimensionamento de painéis, compatibilidade, filtros económicos, validações PV/inversor e escolha das categorias.

- `tariffs.py`
  Contém a lógica dos períodos tarifários e a geração de preços horários. Também decide quando é permitido arbitragem com a rede.

- `constants.py`
  Local central para valores de afinação, como perfis residenciais, factores sazonais solares, rácio mínimo PV/inversor e limites das recomendações.

- `types.py`
  Dataclasses partilhadas. Actualmente contém `SimulationResult`.

- `utils.py`
  Pequenos helpers genéricos usados por vários módulos.

## Regras Importantes

- Recomendações com novo inversor têm de ter pelo menos 80% da potência do inversor em capacidade PV ligada.
- As opções Budget favorecem sistemas mínimos mas coerentes.
- As opções Balanced podem incluir uma matriz PV maior e stacks de baterias.
- Baterias com `max_parallel_connection > 1` podem gerar variantes com vários módulos, como `2x PYLONTECH US3000C`.
- Recomendações com payback irrealista são filtradas antes da divisão por categoria.

