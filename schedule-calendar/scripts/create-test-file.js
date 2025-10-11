const XLSX = require('xlsx');
const path = require('path');

try {
  console.log('Creating a test Excel file that matches the Sample Schedule format...\n');
  
  // Read the original Excel file
  const originalPath = path.join(__dirname, '../../sample-data/Sample Schedule.xlsx');
  const workbook = XLSX.readFile(originalPath);
  
  // Copy the existing workbook structure
  const newWorkbook = XLSX.utils.book_new();
  
  // Copy all sheets from original
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    XLSX.utils.book_append_sheet(newWorkbook, worksheet, sheetName);
  });
  
  // Write to a new file that can be used for testing
  const testPath = path.join(__dirname, '../../sample-data/Test Schedule Upload.xlsx');
  XLSX.writeFile(newWorkbook, testPath);
  
  console.log(`✅ Created test file: ${testPath}`);
  console.log('📋 You can now use this file to test the upload functionality in the web app!');
  
  // Also create a summary of what the parser will find
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log('\n=== EXPECTED PARSING RESULTS ===');
  
  // Count facilities
  const facilityRow = rawData[1];
  let facilityCount = 0;
  for (let colIndex = 2; colIndex < facilityRow.length; colIndex++) {
    const cellValue = facilityRow[colIndex];
    if (cellValue && typeof cellValue === 'string' && cellValue.includes(' - ')) {
      facilityCount++;
    }
  }
  
  // Count unique providers from a few sample days
  const providers = new Set();
  for (let rowIndex = 2; rowIndex < Math.min(10, rawData.length); rowIndex++) {
    const row = rawData[rowIndex];
    if (row && row.length > 2) {
      for (let colIndex = 2; colIndex < row.length; colIndex++) {
        const providerName = row[colIndex];
        if (providerName && typeof providerName === 'string') {
          const cleanName = providerName.replace(/\s*\(Gap\)\s*/i, '').trim();
          if (cleanName) providers.add(cleanName);
        }
      }
    }
  }
  
  console.log(`📊 Facility groups: ${facilityCount}`);
  console.log(`👥 Unique providers (sample): ${providers.size}`);
  console.log(`📅 Schedule days: ${rawData.length - 2}`);
  console.log(`📍 Estimated total sites: 100+`);
  console.log(`📋 Estimated schedule entries: 1000+`);
  
} catch (error) {
  console.error('❌ Error creating test file:', error.message);
}