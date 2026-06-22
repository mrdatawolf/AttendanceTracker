const XLSX = require('xlsx');
const path = require('path');

const excelPath = path.join(process.cwd(), 'examples', 'employee attendance 1.xlsx');

console.log('Reading Excel file:', excelPath);
console.log('='.repeat(80));

try {
  const workbook = XLSX.readFile(excelPath);

  console.log('\nWorkbook Sheets:', workbook.SheetNames);
  console.log('='.repeat(80));

  workbook.SheetNames.forEach((sheetName, index) => {
    console.log(`\n\n--- SHEET ${index + 1}: ${sheetName} ---\n`);

    const worksheet = workbook.Sheets[sheetName];

    // Get the range of the sheet
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    console.log(`Range: ${worksheet['!ref']}`);
    console.log(`Rows: ${range.e.r + 1}, Columns: ${range.e.c + 1}`);

    // Convert to JSON to see the structure
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    // Display first 20 rows
    console.log('\nFirst 20 rows:');
    console.log('-'.repeat(80));
    jsonData.slice(0, 20).forEach((row, i) => {
      console.log(`Row ${i}:`, JSON.stringify(row));
    });

    // Also try with header parsing
    console.log('\n\nParsed with headers:');
    console.log('-'.repeat(80));
    const jsonWithHeaders = XLSX.utils.sheet_to_json(worksheet);
    console.log(JSON.stringify(jsonWithHeaders.slice(0, 5), null, 2));
  });

} catch (error) {
  console.error('Error reading Excel file:', error.message);
  process.exit(1);
}
