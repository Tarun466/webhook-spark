import type { QRImageOptions, ASCIIQROptions, QRCodeErrorCorrectionLevel } from "./types.js";

// QR Code capacity constants
const MODE_NUMERIC = 1;
const MODE_ALPHANUMERIC = 2;
const MODE_BYTE = 4;

// Error correction levels
const ERROR_CORRECTION_BITS: Record<QRCodeErrorCorrectionLevel, number> = {
  'L': 0,
  'M': 1,
  'Q': 2,
  'H': 3
};

// Version 1 QR Code constants (21x21 modules)
const VERSION_1_SIZE = 21;
const VERSION_1_DATA_BITS: Record<QRCodeErrorCorrectionLevel, number> = {
  'L': 152,
  'M': 128,
  'Q': 104,
  'H': 72
};

// Alphanumeric character set
const ALPHANUMERIC_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

interface QRMatrix {
  modules: boolean[][];
  size: number;
}

function getMode(data: string): number {
  if (/^[0-9]*$/.test(data)) return MODE_NUMERIC;
  if (/^[0-9A-Z $%*+\-./:]*$/.test(data)) return MODE_ALPHANUMERIC;
  return MODE_BYTE;
}

function encodeData(data: string, mode: number): number[] {
  const bits: number[] = [];
  
  // Mode indicator (4 bits)
  for (let i = 3; i >= 0; i--) {
    bits.push((mode >> i) & 1);
  }
  
  // Character count indicator (Version 1: 10 bits for numeric, 9 for alphanumeric, 8 for byte)
  let countBits = 8;
  if (mode === MODE_NUMERIC) countBits = 10;
  else if (mode === MODE_ALPHANUMERIC) countBits = 9;
  
  for (let i = countBits - 1; i >= 0; i--) {
    bits.push((data.length >> i) & 1);
  }
  
  // Data encoding
  if (mode === MODE_NUMERIC) {
    for (let i = 0; i < data.length; i += 3) {
      const chunk = data.slice(i, i + 3);
      const num = parseInt(chunk, 10);
      const bitLength = chunk.length === 3 ? 10 : chunk.length === 2 ? 7 : 4;
      for (let j = bitLength - 1; j >= 0; j--) {
        bits.push((num >> j) & 1);
      }
    }
  } else if (mode === MODE_ALPHANUMERIC) {
    for (let i = 0; i < data.length; i += 2) {
      if (i + 1 < data.length) {
        const val1 = ALPHANUMERIC_CHARS.indexOf(data[i]);
        const val2 = ALPHANUMERIC_CHARS.indexOf(data[i + 1]);
        const combined = val1 * 45 + val2;
        for (let j = 10; j >= 0; j--) {
          bits.push((combined >> j) & 1);
        }
      } else {
        const val = ALPHANUMERIC_CHARS.indexOf(data[i]);
        for (let j = 5; j >= 0; j--) {
          bits.push((val >> j) & 1);
        }
      }
    }
  } else {
    // Byte mode
    for (const char of data) {
      const code = char.charCodeAt(0);
      for (let j = 7; j >= 0; j--) {
        bits.push((code >> j) & 1);
      }
    }
  }
  
  // Terminator (4 zeros)
  for (let i = 0; i < 4 && bits.length < VERSION_1_DATA_BITS['M']; i++) {
    bits.push(0);
  }
  
  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }
  
  // Pad bytes (alternating 11101100 and 00010001)
  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (bits.length < VERSION_1_DATA_BITS['M']) {
    const byte = padBytes[padIdx % 2];
    for (let j = 7; j >= 0; j--) {
      bits.push((byte >> j) & 1);
    }
    padIdx++;
  }
  
  return bits;
}

function createMatrix(data: string): QRMatrix {
  const size = VERSION_1_SIZE;
  const modules: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));
  
  // Add finder patterns (corners)
  const addFinderPattern = (row: number, col: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        modules[row + r][col + c] = isBorder || isInner;
      }
    }
  };
  
  addFinderPattern(0, 0); // Top-left
  addFinderPattern(0, size - 7); // Top-right
  addFinderPattern(size - 7, 0); // Bottom-left
  
  // Add separators (white borders around finders)
  const addSeparator = (row: number, col: number, w: number, h: number) => {
    for (let r = -1; r <= h; r++) {
      for (let c = -1; c <= w; c++) {
        const mr = row + r;
        const mc = col + c;
        if (mr >= 0 && mr < size && mc >= 0 && mc < size) {
          if (r === -1 || r === h || c === -1 || c === w) {
            modules[mr][mc] = false;
          }
        }
      }
    }
  };
  
  addSeparator(0, 0, 7, 7);
  addSeparator(0, size - 7, 7, 7);
  addSeparator(size - 7, 0, 7, 7);
  
  // Add timing patterns
  for (let i = 8; i < size - 8; i++) {
    modules[6][i] = i % 2 === 0;
    modules[i][6] = i % 2 === 0;
  }
  
  // Add dark module
  modules[size - 8][8] = true;
  
  // Add format info (simplified - uses mask pattern 000)
  const formatInfo = 0b0101000000011100; // Mask 000, Error correction M
  for (let i = 0; i < 15; i++) {
    const bit = (formatInfo >> i) & 1;
    if (i < 6) {
      modules[8][i] = !!bit;
      modules[size - 1 - i][8] = !!bit;
    } else if (i < 8) {
      modules[8][i + 1] = !!bit;
      modules[size - 7 + i][8] = !!bit;
    } else if (i < 9) {
      modules[7][8] = !!bit;
      modules[8][size - 8] = !!bit;
    } else {
      modules[14 - i][8] = !!bit;
      modules[8][size - 15 + i] = !!bit;
    }
  }
  
  // Place data bits
  const mode = getMode(data);
  const bits = encodeData(data, mode);
  let bitIdx = 0;
  
  // Upward columns
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // Skip timing column
    
    for (let row = 0; row < size; row++) {
      const actualRow = (col < size - 8) ? size - 1 - row : size - 1 - row;
      
      for (let c = 0; c < 2; c++) {
        const currentCol = col - c;
        if (currentCol < 0) continue;
        
        // Skip function patterns
        if (modules[actualRow][currentCol] !== false && 
            !isFunctionPattern(actualRow, currentCol, size)) {
          if (bitIdx < bits.length) {
            modules[actualRow][currentCol] = !!bits[bitIdx];
            bitIdx++;
          }
        }
      }
    }
  }
  
  return { modules, size };
}

function isFunctionPattern(row: number, col: number, size: number): boolean {
  // Finder patterns and separators
  if ((row < 9 && col < 9) || (row < 9 && col >= size - 8) || (row >= size - 8 && col < 9)) {
    return true;
  }
  // Timing patterns
  if (row === 6 || col === 6) return true;
  // Dark module
  if (row === size - 8 && col === 8) return true;
  // Format info
  if ((row === 8 && col < 9) || (row === 8 && col >= size - 8) ||
      (col === 8 && row < 9) || (col === 8 && row >= size - 7)) return true;
  return false;
}

export function generateQRCode(text: string, options: QRImageOptions = {}): string {
  if (!text || text.length === 0) {
    throw new Error("Input text cannot be empty");
  }
  
  const {
    errorCorrection = 'M',
    margin = 4,
    size = 21,
    darkColor = '#000000',
    lightColor = '#ffffff'
  } = options;
  
  const matrix = createMatrix(text);
  const moduleCount = matrix.size;
  const moduleSize = Math.max(1, Math.floor(size / moduleCount));
  const actualSize = moduleCount * moduleSize;
  const totalSize = actualSize + (margin * 2 * moduleSize);
  
  let svg = `<svg width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Background
  svg += `<rect width="100%" height="100%" fill="${lightColor}"/>`;
  
  // QR modules
  const offset = margin * moduleSize;
  for (let y = 0; y < moduleCount; y++) {
    for (let x = 0; x < moduleCount; x++) {
      if (matrix.modules[y][x]) {
        svg += `<rect x="${offset + x * moduleSize}" y="${offset + y * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="${darkColor}"/>`;
      }
    }
  }
  
  svg += '</svg>';
  return svg;
}

export function generateASCIIQR(text: string, options: ASCIIQROptions = {}): string {
  if (!text || text.length === 0) {
    throw new Error("Input text cannot be empty");
  }
  
  const {
    errorCorrection = 'M',
    margin = 4,
    inverted = false,
    blockChar = '██',
    whiteChar = '  '
  } = options;
  
  const matrix = createMatrix(text);
  const { modules, size } = matrix;
  
  const dark = inverted ? whiteChar : blockChar;
  const light = inverted ? blockChar : whiteChar;
  
  let result = '';
  
  // Top margin
  for (let i = 0; i < margin; i++) {
    result += light.repeat(size + margin * 2) + '\n';
  }
  
  // QR content
  for (let y = 0; y < size; y++) {
    result += light.repeat(margin);
    for (let x = 0; x < size; x++) {
      result += modules[y][x] ? dark : light;
    }
    result += light.repeat(margin) + '\n';
  }
  
  // Bottom margin
  for (let i = 0; i < margin; i++) {
    result += light.repeat(size + margin * 2) + '\n';
  }
  
  return result.slice(0, -1); // Remove last newline
}
