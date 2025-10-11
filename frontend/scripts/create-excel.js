const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Read the CSV file
const csvPath = path.join(__dirname, '../sample-data/sample-schedule.csv');
const csvContent = fs.readFileSync(csvPath, 'utf8');

// Parse CSV content
const rows = csvContent.split('\n').map(row => row.split(','));
const headers = rows[0];
const data = rows.slice(1).map(row => {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] || '';
  });
  return obj;
});

// Create workbook and worksheet
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(data);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule');

// Write the Excel file
const excelPath = path.join(__dirname, '../sample-data/Sample Schedule.xlsx');
XLSX.writeFile(workbook, excelPath);

console.log('Excel file created successfully at:', excelPath);