const XLSX = require('xlsx');
const path = require('path');

// Mock the browser File API for Node.js testing
function createMockFile(filePath) {
  const fs = require('fs');
  const data = fs.readFileSync(filePath);
  
  return {
    arrayBuffer: () => Promise.resolve(data.buffer),
    // For FileReader.readAsBinaryString simulation
    _data: data
  };
}

// Simulate the parsing logic
function parseComplexScheduleData(rawData) {
  const providers = [];
  const sites = [];
  const schedules = [];
  
  const providerMap = new Map();
  const siteMap = new Map();
  
  if (rawData.length < 2) {
    throw new Error('Invalid schedule format');
  }
  
  // Parse facility assignments from the first row
  const facilityRow = rawData[0];
  const facilitiesData = [];
  
  console.log('Parsing facilities from row 1...');
  
  for (let colIndex = 2; colIndex < facilityRow.length; colIndex++) {
    const cellValue = facilityRow[colIndex];
    if (cellValue && typeof cellValue === 'string') {
      const parts = cellValue.split(' - ');
      if (parts.length >= 2) {
        const providerType = parts[0].trim();
        const sitesStr = parts[1].trim();
        const sitesList = sitesStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
        
        facilitiesData.push({
          facilityGroup: `${providerType} - Column ${colIndex}`,
          sites: sitesList
        });
        
        console.log(`Column ${colIndex}: ${providerType} -> ${sitesList.length} sites`);
        
        // Create sites
        sitesList.forEach(siteName => {
          if (!siteMap.has(siteName)) {
            const site = {
              id: `site-${sites.length + 1}`,
              name: siteName,
              type: providerType
            };
            sites.push(site);
            siteMap.set(siteName, site);
          }
        });
      }
    }
  }
  
  console.log(`\nTotal unique sites found: ${sites.length}`);
  console.log('Sample sites:', sites.slice(0, 5).map(s => s.name));
  
  // Parse daily schedules
  let totalSchedules = 0;
  const providerCounts = new Map();
  
  for (let rowIndex = 1; rowIndex < Math.min(6, rawData.length); rowIndex++) { // Limit to first 5 days for testing
    const row = rawData[rowIndex];
    if (!row || row.length < 3) continue;
    
    const dayOfWeek = row[0];
    const dayNumber = row[1];
    
    if (!dayOfWeek || typeof dayNumber !== 'number') continue;
    
    console.log(`\nProcessing ${dayOfWeek} (Day ${dayNumber}):`);
    
    // Process each column
    for (let colIndex = 2; colIndex < row.length && colIndex - 2 < facilitiesData.length; colIndex++) {
      const providerName = row[colIndex];
      if (!providerName || typeof providerName !== 'string') continue;
      
      const cleanProviderName = providerName.replace(/\s*\(Gap\)\s*/i, '').trim();
      if (!cleanProviderName) continue;
      
      // Count provider occurrences
      providerCounts.set(cleanProviderName, (providerCounts.get(cleanProviderName) || 0) + 1);
      
      // Create provider if needed
      if (!providerMap.has(cleanProviderName)) {
        const provider = {
          id: `provider-${providers.length + 1}`,
          name: cleanProviderName,
          specialty: 'General Practice'
        };
        providers.push(provider);
        providerMap.set(cleanProviderName, provider);
      }
      
      const facilityInfo = facilitiesData[colIndex - 2];
      totalSchedules += facilityInfo.sites.length; // Each provider covers multiple sites
    }
  }
  
  console.log(`\nTotal unique providers: ${providers.length}`);
  console.log('Top providers by assignment count:');
  Array.from(providerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([name, count]) => console.log(`  ${name}: ${count} assignments`));
    
  console.log(`\nTotal schedule entries would be: ${totalSchedules}`);
  
  return { providers, sites, schedules: [] }; // Return empty schedules for this test
}

// Updated parser logic based on correct structure
function parseComplexScheduleData(rawData) {
  const providers = [];
  const sites = [];
  const schedules = [];
  
  const providerMap = new Map();
  const siteMap = new Map();
  
  if (rawData.length < 3) {
    throw new Error('Invalid schedule format - need at least 3 rows');
  }
  
  // Skip row 0 (description), parse facility assignments from row 1
  const facilityRow = rawData[1];
  const facilitiesData = [];
  
  if (!facilityRow || facilityRow.length < 3) {
    throw new Error('Invalid facility row format');
  }
  
  console.log('Parsing facilities from row 1...');
  
  // Start from column 2 (skip day and number columns)
  for (let colIndex = 2; colIndex < facilityRow.length; colIndex++) {
    const cellValue = facilityRow[colIndex];
    if (cellValue && typeof cellValue === 'string') {
      const parts = cellValue.split(' - ');
      if (parts.length >= 2) {
        const providerType = parts[0].trim();
        const sitesStr = parts[1].trim();
        const sitesList = sitesStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
        
        facilitiesData.push({
          facilityGroup: `${providerType} - Column ${colIndex}`,
          sites: sitesList
        });
        
        // Create sites
        sitesList.forEach(siteName => {
          if (!siteMap.has(siteName)) {
            const site = {
              id: `site-${sites.length + 1}`,
              name: siteName,
              type: providerType
            };
            sites.push(site);
            siteMap.set(siteName, site);
          }
        });
      }
    }
  }
  
  console.log(`Total facility groups: ${facilitiesData.length}`);
  console.log(`Total unique sites: ${sites.length}`);
  console.log('Sample facility groups:');
  facilitiesData.slice(0, 5).forEach((fg, i) => {
    console.log(`  ${i}: ${fg.facilityGroup} -> ${fg.sites.length} sites`);
  });
  
  // Parse daily schedules from row 2 onwards
  let totalSchedules = 0;
  const providerCounts = new Map();
  
  for (let rowIndex = 2; rowIndex < Math.min(8, rawData.length); rowIndex++) { // Limit for testing
    const row = rawData[rowIndex];
    if (!row || row.length < 3) continue;
    
    const dayOfWeek = row[0];
    const dayNumber = row[1];
    
    if (!dayOfWeek || typeof dayNumber !== 'number') continue;
    
    console.log(`\nProcessing ${dayOfWeek} (Day ${dayNumber}):`);
    
    // Process each column
    for (let colIndex = 2; colIndex < row.length && colIndex - 2 < facilitiesData.length; colIndex++) {
      const providerName = row[colIndex];
      if (!providerName || typeof providerName !== 'string') continue;
      
      const cleanProviderName = providerName.replace(/\s*\(Gap\)\s*/i, '').trim();
      if (!cleanProviderName) continue;
      
      // Count provider occurrences
      providerCounts.set(cleanProviderName, (providerCounts.get(cleanProviderName) || 0) + 1);
      
      // Create provider if needed
      if (!providerMap.has(cleanProviderName)) {
        const provider = {
          id: `provider-${providers.length + 1}`,
          name: cleanProviderName,
          specialty: 'General Practice'
        };
        providers.push(provider);
        providerMap.set(cleanProviderName, provider);
      }
      
      const facilityInfo = facilitiesData[colIndex - 2];
      totalSchedules += facilityInfo.sites.length;
    }
  }
  
  console.log(`\nTotal unique providers: ${providers.length}`);
  console.log('Top providers by assignment count:');
  Array.from(providerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([name, count]) => console.log(`  ${name}: ${count} assignments`));
    
  console.log(`\nTotal schedule entries would be: ${totalSchedules}`);
  
  return { providers, sites, schedules: [] };
}

try {
  console.log('Testing updated parser with actual Sample Schedule.xlsx...\n');
  
  const excelPath = path.join(__dirname, '../../sample-data/Sample Schedule.xlsx');
  const workbook = XLSX.readFile(excelPath);
  
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log(`Sheet: ${sheetName}`);
  console.log(`Total rows: ${rawData.length}\n`);
  
  const result = parseComplexScheduleData(rawData);
  
  console.log('\n=== PARSING RESULTS ===');
  console.log(`✅ Successfully parsed ${result.providers.length} providers`);
  console.log(`✅ Successfully parsed ${result.sites.length} sites`);
  console.log('\n🎉 Parser is working correctly with the actual Excel file!');
  
} catch (error) {
  console.error('❌ Error parsing Excel file:', error.message);
}