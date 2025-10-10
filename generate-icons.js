#!/usr/bin/env node

const png2icons = require('png2icons');
const fs = require('fs');
const path = require('path');

// Path to source PNG (use the 128x128@2x which is actually 256x256)
const inputPath = path.join(__dirname, 'src-tauri', 'icons', '128x128@2x.png');
const outputPath = path.join(__dirname, 'src-tauri', 'icons', 'icon.icns');

console.log('Generating macOS .icns file...');
console.log('Input:', inputPath);
console.log('Output:', outputPath);

// Read the PNG file
const input = fs.readFileSync(inputPath);

try {
  // Convert to ICNS (synchronous)
  const output = png2icons.createICNS(input, png2icons.BILINEAR, 0);
  fs.writeFileSync(outputPath, output);
  console.log('✅ Successfully generated icon.icns');
} catch (err) {
  console.error('❌ Error generating icon:', err);
  process.exit(1);
}
