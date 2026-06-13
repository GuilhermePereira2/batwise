const fs = require('fs');
// Basic manual mapping for common mangled UTF-8 characters as seen in CP1252
const map = {
    'Ã³': 'ó',
    'Ã£': 'ã',
    'Ã§': 'ç',
    'Ã¡': 'á',
    'Ã©': 'é',
    'Ã­': 'í',
    'Ãº': 'ú',
    'Ã ': 'à',
    'Ãª': 'ê',
    'Ã´': 'ô',
    'â‚¬': '€',
    'Âº': 'º',
    'Â²': '²',
    'Ã€': 'À',
    'Ã‰': 'É',
    'Ã“': 'Ó',
    'Ã': 'Í',
    'Ãš': 'Ú',
    'Ã‡': 'Ç',
    'Ãƒ': 'Ã'
};

const filePath = 'frontend/src/pages/Simulator.tsx';
let content = fs.readFileSync(filePath, 'utf8');

for (const [mangled, fixed] of Object.entries(map)) {
    content = content.split(mangled).join(fixed);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed common encoding issues in Simulator.tsx');
