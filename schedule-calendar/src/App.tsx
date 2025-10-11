import { useState } from 'react';
import UserManagement, { UserAccount } from './components/UserManagement';
import './components/UserManagement.css';
import PhysicianView from './components/PhysicianView';
import './components/PhysicianView.css';
import Calendar from './components/Calendar';
import FilterPanel from './components/FilterPanel';
import ScheduleDetail from './components/ScheduleDetail';
import StatsSummary from './components/StatsSummary';
import { ScheduleData, Provider, Site } from './types/schedule';
import { parseScheduleExcel } from './utils/scheduleParser';
import Login from './components/Login';
import './App.css';

function getInitialAuth() {
  // For demo: not logged in
  return { isAuthenticated: false, username: '', role: undefined, providerId: undefined as string | undefined };
}

export type UserRole = 'admin' | 'physician';


function App() {
  // Admin tab state: 'calendar' or 'users'
  const [adminTab, setAdminTab] = useState<'calendar' | 'users'>('calendar');
  const [scheduleData, setScheduleData] = useState<ScheduleData>({ providers: [], sites: [], schedules: [] });
  const [selectedProvider, setSelectedProvider] = useState<Provider | undefined>();
  const [selectedSite, setSelectedSite] = useState<Site | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [auth, setAuth] = useState<{ isAuthenticated: boolean; username: string; role?: UserRole; providerId?: string | null }>(getInitialAuth());

  // Demo: user accounts state (in-memory only)
  const [users, setUsers] = useState<UserAccount[]>([
    { username: 'admin', password: 'admin123', role: 'admin' },
    { username: 'physician', password: 'physician123', role: 'physician' },
  ]);

  const handleAddUser = (user: UserAccount) => {
    setUsers(prev => [...prev, user]);
  };
  const handleEditUser = (user: UserAccount) => {
    setUsers(prev => prev.map(u => u.username === user.username ? user : u));
  };
  const handleDeleteUser = (username: string) => {
    setUsers(prev => prev.filter(u => u.username !== username));
  };

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setError(undefined);
    setSuccessMessage(undefined);
    try {
      const data = await parseScheduleExcel(file);
      setScheduleData(data);
      // Reset filters when new data is loaded
      setSelectedProvider(undefined);
      setSelectedSite(undefined);
      setSuccessMessage(`Successfully loaded ${data.providers.length} providers and ${data.sites.length} sites with ${data.schedules.length} schedule entries!`);
    } catch (err) {
      setError('Failed to parse Excel file. Please check the file format and ensure it matches the expected structure.');
      console.error('Error parsing file:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleCloseDetail = () => {
    setSelectedDate(undefined);
  };

  const handleLogin = async (user: { username: string; role: UserRole; providerId?: string | null }) => {
    setAuth({ isAuthenticated: true, username: user.username, role: user.role, providerId: user.providerId });
    await loadScheduleData();
  };
  const handleLogout = () => {
    setAuth({ isAuthenticated: false, username: '', role: undefined, providerId: undefined });
    // Do NOT clear scheduleData here; keep it loaded for next login
  };

  // Loads schedule data from backend
  const loadScheduleData = async () => {
    try {
      const { api } = await import('./utils/api');
      const [providers, sites, schedules] = await Promise.all([
        api.getProviders(),
        api.getSites(),
        api.getSchedules()
      ]);
      // Convert API data back to frontend format
      const convertedSchedules = schedules.map(s => ({
        id: s.id,
        providerId: s.providerId,
        siteId: s.siteId,
        date: new Date(s.date + 'T00:00:00'),
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status as 'scheduled' | 'confirmed' | 'cancelled',
        notes: s.notes || ''
      }));
      setScheduleData({ providers, sites, schedules: convertedSchedules });
    } catch (err) {
      setError('Failed to load schedule data from backend.');
      console.error('Error loading schedule data:', err);
    }
  };

  if (!auth.isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (auth.role === 'physician') {
    // Find provider object for logged-in physician
    let provider: Provider | undefined = undefined;
    if (auth.providerId) {
      provider = scheduleData.providers.find(p => p.id === auth.providerId);
    }
    // Fallback to username matching if providerId isn't set or not found
    if (!provider) {
      provider = scheduleData.providers.find(p => p.name.toLowerCase() === auth.username.toLowerCase());
    }
    if (!provider) {
      return (
        <div className="unauthorized">
          <h2>No Provider Record</h2>
          <p>Your account is not linked to a provider in the schedule data.</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      );
    }
    return (
      <>
        <div style={{ background: '#f8f8e0', border: '1px solid #ccc', padding: 10, margin: '10px 0', borderRadius: 6, fontSize: 14 }}>
          <b>My Account Debug:</b><br />
          Username: <code>{auth.username}</code><br />
          ProviderId: <code>{auth.providerId || 'Not set'}</code><br />
          Matched Provider: <code>{provider ? provider.name + ' (' + provider.id + ')' : 'None'}</code>
        </div>
        <PhysicianView provider={provider} scheduleData={scheduleData} onLogout={handleLogout} />
      </>
    );
  }

  if (auth.role !== 'admin') {
    return (
      <div className="unauthorized">
        <h2>Unauthorized</h2>
        <p>You do not have access to the admin calendar view.</p>
        <button onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Provider Schedule Calendar</h1>
        <p>View and manage provider schedules across different sites</p>
        <button className="logout-btn" onClick={handleLogout} style={{ position: 'absolute', top: 20, right: 20 }}>
          Logout
        </button>
        <nav className="admin-tabs" style={{ marginTop: 20 }}>
          <button
            onClick={() => setAdminTab('calendar')}
            style={{ fontWeight: adminTab === 'calendar' ? 'bold' : 'normal', marginRight: 10 }}
          >
            Calendar
          </button>
          <button
            onClick={() => setAdminTab('users')}
            style={{ fontWeight: adminTab === 'users' ? 'bold' : 'normal' }}
          >
            User Management
          </button>
        </nav>
      </header>
      <main className="App-main">
        {adminTab === 'users' ? (
          <UserManagement
            users={users}
            providers={scheduleData.providers}
            onAdd={handleAddUser}
            onEdit={handleEditUser}
            onDelete={handleDeleteUser}
          />
        ) : (
          <>
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="success-message">
                {successMessage}
              </div>
            )}
            {isLoading && (
              <div className="loading-message">
                Loading schedule data...
              </div>
            )}
            <FilterPanel
              providers={scheduleData.providers}
              sites={scheduleData.sites}
              selectedProvider={selectedProvider}
              selectedSite={selectedSite}
              onProviderChange={setSelectedProvider}
              onSiteChange={setSelectedSite}
              onFileUpload={handleFileUpload}
              isLoading={isLoading}
            />
            <StatsSummary
              scheduleData={scheduleData}
              selectedProvider={selectedProvider}
              selectedSite={selectedSite}
            />
            <Calendar
              schedules={scheduleData.schedules}
              providers={scheduleData.providers}
              sites={scheduleData.sites}
              selectedProvider={selectedProvider}
              selectedSite={selectedSite}
              onDateClick={handleDateClick}
            />
            <ScheduleDetail
              selectedDate={selectedDate}
              schedules={scheduleData.schedules}
              providers={scheduleData.providers}
              sites={scheduleData.sites}
              selectedProvider={selectedProvider}
              selectedSite={selectedSite}
              onClose={handleCloseDetail}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
