import json

# Read the cells.json file
with open('cells.json', 'r') as f:
    cells = json.load(f)

# Sort by band first, then by name
sorted_cells = sorted(cells, key=lambda x: (x.get('Brand', ''), x.get('CellModelNo', '')))

# Write back to the file
with open('cells.json', 'w') as f:
    json.dump(sorted_cells, f, indent=2)

print("Cells sorted successfully!")