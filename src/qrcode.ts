type QRCodeModule = boolean[];

function createQRMatrix(data: string, errorCorrection: QRCodeErrorCorrectionLevel = 'L'): QRCodeModule[] {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);
  
  // Simplified QR code matrix generation
  const size = 21; // Version 1 QR code size
  const matrix: QRCodeModule[] = Array(size).fill(null).map(() => Array(size).fill(false));

  // Add basic finder patterns
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      matrix[i][j] = (i < 2 || j < 2 || i > 4 || j > 4) || (i > 1 && i < 5 && j > 1 && j < 5);
      matrix[size - i - 1][j] = matrix[i][j];
      matrix[i][size - j - 1] = matrix[i][j];
    }
  }

  // Add timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Simple data encoding (real implementation would use proper encoding)
  let x = size - 1;
  let y = size - 1;
  let vertical = true;
  
  encoded.forEach((byte, idx) => {
    for (let b = 7; b >= 0; b--) {
      const bit = (byte >> b) & 1;
      matrix[y][x] = !!bit;
      
      if (vertical) {
        y--;
        if (y < 0) {
          y = 0;
          x -= 2;
          vertical = false;
        }
      } else {
        y++;
        if (y >= size) {
          y = size - 1;
          x -= 2;
          vertical = true;
        }
      }
    }
  });

  return matrix;
}

export function generateQRCode(text: string, options: QRImageOptions = {}): string {
  if (!text) throw new Error("Input text cannot be empty");
  
  const matrix = createQRMatrix(text, options.errorCorrection);
  const size = options.size || 200;
  const margin = options.margin ?? 4;
  const dark = options.darkColor || '#000000';
  const light = options.lightColor || '#ffffff';

  const cellSize = size / (matrix.length + 2 * margin);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    `<rect width="100%" height="100%" fill="${light}"/>`,
  ];

  matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        svg.push(`<rect x="${(x + margin) * cellSize}" y="${(y + margin) * cellSize}" width="${cellSize}" height="${cellSize}" fill="${dark}"/>`);
      }
    });
  });

  svg.push('</svg>');
  return svg.join('\n');
}

export function generateASCIIQR(text: string, options: ASCIIQROptions = {}): string {
  if (!text) throw new Error("Input text cannot be empty");
  
  const matrix = createQRMatrix(text, options.errorCorrection);
  const margin = options.margin ?? 2;
  const block = options.blockChar || '██';
  const white = options.whiteChar || '  ';
  const inverted = options.inverted ?? false;

  const fullMatrix = [
    ...Array(margin).fill(null).map(() => Array(matrix.length + margin * 2).fill(!inverted)),
    ...matrix.map(row => [
      ...Array(margin).fill(!inverted),
      ...row.map(cell => inverted ? !cell : cell),
      ...Array(margin).fill(!inverted)
    ]),
    ...Array(margin).fill(null).map(() => Array(matrix.length + margin * 2).fill(!inverted))
  ];

  return fullMatrix
    .map(row => row.map(cell => cell ? block : white).join(''))
    .join('\n');
}
