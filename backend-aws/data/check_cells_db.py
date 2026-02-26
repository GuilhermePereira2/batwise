#!/usr/bin/env python3
"""
Script para validar o ficheiro cells.json
Verifica:
1. Se células cilíndricas tem Cell_Thickness == Cell_Width
2. Se existem células duplicadas
"""

import json
from pathlib import Path
from collections import defaultdict

def validate_cells():
    cells_file = Path(__file__).parent / "cells.json"
    
    try:
        with open(cells_file, 'r', encoding='utf-8') as f:
            cells = json.load(f)
    except FileNotFoundError:
        print(f"❌ Ficheiro não encontrado: {cells_file}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ Erro ao parsear JSON: {e}")
        return False
    
    if not isinstance(cells, list):
        print("❌ O ficheiro deve conter um array JSON")
        return False
    
    print(f"✅ Carregadas {len(cells)} células\n")
    
    warnings = []
    duplicates = defaultdict(list)
    
    # Validar cada célula
    for i, cell in enumerate(cells):
        # Verificar se é cilíndrica
        cell_stack = cell.get("Cell_Stack", "")
        is_cylindrical = cell_stack.startswith("C -")
        
        if is_cylindrical:
            cell_thickness = cell.get("Cell_Thickness")
            cell_width = cell.get("Cell_Width")
            
            # Para cilíndricas, Width e Thickness devem ser iguais
            if cell_thickness != cell_width:
                brand = cell.get("Brand", "Unknown")
                model = cell.get("CellModelNo", "Unknown")
                warnings.append(
                    f"⚠️  Linha {i+2}: [{brand} {model}] - Cilíndrica mas "
                    f"Cell_Thickness ({cell_thickness}) ≠ Cell_Width ({cell_width})"
                )
        
        # Verificar duplicatas por Brand + CellModelNo
        key = (cell.get("Brand", ""), cell.get("CellModelNo", ""))
        if key[0] and key[1]:  # Se ambos têm valor
            duplicates[key].append(i + 2)  # +2 para linha (1-indexed) e cabeçalho
    
    # Reportar duplicatas
    for (brand, model), lines in duplicates.items():
        if len(lines) > 1:
            warnings.append(
                f"⚠️  Duplicada: [{brand} {model}] aparece {len(lines)} vezes "
                f"(linhas: {', '.join(map(str, lines))})"
            )
    
    # Imprimir warnings
    if warnings:
        print("⚠️  AVISOS ENCONTRADOS:\n")
        for warning in sorted(warnings):
            print(f"  {warning}")
        print(f"\n📊 Total de avisos: {len(warnings)}\n")
        return False
    else:
        print("✅ Nenhum aviso encontrado!")
        print("   • Todas as células cilíndricas têm Cell_Thickness == Cell_Width")
        print("   • Sem células duplicadas\n")
        return True

if __name__ == "__main__":
    import sys
    success = validate_cells()
    sys.exit(0 if success else 1)
