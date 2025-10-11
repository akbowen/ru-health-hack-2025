const XLSX = require('xlsx');
const path = require('path');

try {
  // Read the existing Excel file
  const excelPath = path.join(__dirname, '../../sample-data/Sample Schedule.xlsx');
  const workbook = XLSX.readFile(excelPath);
  
  // Get the first sheet name
  const sheetName = workbook.SheetNames[0];
  console.log('Sheet name:', sheetName);
  
  // Get the worksheet
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON to see the structure
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log('\nFile structure:');
  console.log('Number of rows:', data.length);
  
  if (data.length > 0) {
    console.log('\nHeaders (first row):');
    console.log(data[0]);
    
    console.log('\nFirst few data rows:');
    for (let i = 1; i < Math.min(6, data.length); i++) {
      console.log(`Row ${i}:`, data[i]);
    }
  }
  
  // Also get as objects
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  console.log('\nSample data as objects:');
  console.log(JSON.stringify(jsonData.slice(0, 3), null, 2));
  
} catch (error) {
  console.error('Error reading Excel file:', error.message);
}