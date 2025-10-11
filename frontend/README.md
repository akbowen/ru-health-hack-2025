# Provider Schedule Calendar

A React application specifically designed to display and manage provider schedules from the **Sample Schedule.xlsx** format. This application parses complex Excel schedules with multiple providers across numerous healthcare facilities and presents them in an intuitive calendar interface.

## ✨ Features

- **📅 Calendar View**: Monthly calendar displaying all scheduled appointments with provider and site information
- **🔍 Advanced Filtering**: Filter schedules by specific providers or healthcare sites
- **📊 Statistics Dashboard**: Real-time summary of providers, sites, and schedule assignments
- **📁 Excel Integration**: Direct upload and parsing of the Sample Schedule.xlsx format
- **📱 Responsive Design**: Optimized for desktop and mobile devices
- **⌨️ Keyboard Navigation**: Use arrow keys and Home key for quick navigation
- **📋 Detailed Views**: Click any date to see comprehensive appointment details

## 🚀 Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation & Running

1. Navigate to the schedule-calendar directory:
   ```bash
   cd schedule-calendar
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open your browser to `http://localhost:3000`

## 📋 Using the Application

### Sample Data
The application loads with sample data based on the actual Sample Schedule.xlsx structure, showing realistic provider assignments across multiple healthcare facilities.

### Uploading Your Schedule
1. Click **"Choose Excel File"** in the filter panel
2. Select your `Sample Schedule.xlsx` file (or the test file: `Test Schedule Upload.xlsx`)
3. The application will automatically parse and display:
   - All providers from the schedule
   - All healthcare sites and facilities
   - Daily assignments for each provider-site combination
   - Schedule statistics and overview

### Expected Excel File Structure

The application expects the specific format found in `sample-data/Sample Schedule.xlsx`:

- **Row 1**: Description text (ignored)
- **Row 2**: Facility assignments in format: `MD1 - Site1, Site2, Site3`
- **Row 3+**: Daily schedules with:
  - Column A: Day of week (Wed, Thur, Fri, etc.)
  - Column B: Day number (1, 2, 3, etc.)
  - Column C+: Provider names for each facility

### Navigation & Interaction

- **Calendar Navigation**: 
  - Use ← → buttons or arrow keys to navigate months
  - Click "Today" button or press Home key to return to current date
  
- **Filtering**:
  - Select specific providers from the dropdown to view only their schedules
  - Select specific sites to view all providers assigned to that location
  - Combine filters to see specific provider-site assignments
  - Remove filters by clicking the "×" button on active filter tags

- **Schedule Details**:
  - Click any calendar date to see detailed appointment information
  - View provider specialties, site types, and appointment times
  - See status indicators (confirmed, scheduled, cancelled)

### Understanding the Data

The Sample Schedule.xlsx contains:
- **88+ facility groups** (MD1, MD2, PM classifications)
- **100+ unique healthcare sites** 
- **30+ providers** with varying assignments
- **32 days** of scheduling data
- **1000+ individual schedule entries**

## 🏥 Data Structure Explanation

### Provider Types
- **MD1**: Primary care physicians and general practitioners
- **MD2**: Specialty care physicians and consultants  
- **PM**: Practice management and administrative staff

### Site Abbreviations
The Excel file uses abbreviated site names (e.g., WRMC, SSMM, NNSMC) representing different healthcare facilities. Each facility group in the Excel corresponds to specific sites where providers are assigned.

### Schedule Entries
Each cell in the Excel represents a provider assignment to all sites in that facility group for a specific day. The application expands this to create individual schedule entries for each provider-site combination.

## 🛠 Technical Details

### Parser Logic
The application includes a sophisticated parser (`scheduleParser.ts`) that:
1. Skips the description row (Row 1)
2. Parses facility assignments from Row 2
3. Extracts daily provider assignments from subsequent rows
4. Creates individual schedule entries for each provider-site combination
5. Handles "Gap" coverage and special annotations

### Components
- **Calendar**: Main calendar display with month view
- **FilterPanel**: Provider and site filtering controls with file upload
- **ScheduleDetail**: Detailed modal view for specific dates
- **StatsSummary**: Real-time statistics and overview dashboard

### Data Types
```typescript
interface Provider {
  id: string;
  name: string;
  specialty?: string;
}

interface Site {
  id: string;
  name: string;
  type?: string;
}

interface ScheduleEntry {
  id: string;
  providerId: string;
  siteId: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'confirmed' | 'cancelled';
  notes?: string;
}
```

## 🧪 Testing

A test file `Test Schedule Upload.xlsx` is created in the sample-data directory that you can use to test the upload functionality without modifying the original Sample Schedule.xlsx.

## 📱 Mobile Support

The application is fully responsive and includes:
- Touch-friendly navigation
- Optimized calendar layout for mobile screens
- Collapsible filter interface
- Readable schedule details on small screens

## 🔧 Troubleshooting

### File Upload Issues
- Ensure your Excel file matches the expected format
- Check that the file has the facility assignments in Row 2
- Verify that daily schedules start from Row 3

### Performance Considerations
The application efficiently handles large schedule files but may take a moment to process files with 1000+ schedule entries.

## 📄 License

This project is licensed under the MIT License.