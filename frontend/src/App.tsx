import { useState, useEffect } from 'react';
import UserManagement, { UserAccount } from './components/UserManagement';
import AddSchedule from './components/AddSchedule';
import './components/UserManagement.css';
import PhysicianView from './components/PhysicianView';
import './components/PhysicianView.css';
import HospitalView from './components/HospitalView';
import './components/HospitalView.css';
import Calendar from './components/Calendar';
import FilterPanel from './components/FilterPanel';
import ScheduleDetail from './components/ScheduleDetail';
import StatsSummary from './components/StatsSummary';
import { ScheduleData, Provider, Site } from './components/types/schedule';
import { parseScheduleExcel } from './utils/scheduleParser';
import Login from './components/Login';
import './App.css';
import { add } from 'date-fns';
import AdminAnalyticsUpload from './components/AdminAnalyticsUpload';

function getInitialAuth() {
  // For demo: not logged in
  return {
    isAuthenticated: false,
    username: "",
    role: undefined,
    providerId: undefined as string | undefined,
    siteId: undefined as string | undefined,
  };
}

export type UserRole = "admin" | "physician" | "hospital";

function App() {
  // Admin tab state: 'calendar' or 'users'

  const [adminTab, setAdminTab] = useState<
    "calendar" | "users" | "addSchedule" | "analytics"
  >("calendar");
  const [scheduleData, setScheduleData] = useState<ScheduleData>({
    providers: [],
    sites: [],
    schedules: [],
  });
  const [selectedProvider, setSelectedProvider] = useState<
    Provider | undefined
  >();
  const [selectedSite, setSelectedSite] = useState<Site | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [auth, setAuth] = useState<{
    isAuthenticated: boolean;
    username: string;
    role?: UserRole;
    providerId?: string | null;
    siteId?: string | null;
  }>(getInitialAuth());

  // User accounts state (loaded from database)
  const [users, setUsers] = useState<UserAccount[]>([]);

  const handleAddUser = async (user: UserAccount) => {
    try {
      const { api } = await import("./utils/api");

      // Clean up the data before sending
      const userData = {
        username: user.username,
        password: user.password,
        role: user.role,
        ...(user.providerId &&
          user.providerId.trim() !== "" && { providerId: user.providerId }),
        ...(user.siteId &&
          user.siteId.trim() !== "" && { siteId: user.siteId }),
      };

      console.log("Sending user data:", userData);
      await api.createUser(userData);
      setUsers((prev) => [...prev, user]);
      setSuccessMessage("User created successfully");
    } catch (error: any) {
      console.error("Failed to create user:", error);
      setError(`Failed to create user: ${error.message}`);
    }
  };

  const handleEditUser = async (user: UserAccount) => {
    try {
      const { api } = await import("./utils/api");
      await api.updateUser(user.username, {
        password: user.password,
        role: user.role,
        providerId: user.providerId,
        siteId: user.siteId,
      });
      setUsers((prev) =>
        prev.map((u) => (u.username === user.username ? user : u))
      );
      setSuccessMessage("User updated successfully");
    } catch (error: any) {
      setError(`Failed to update user: ${error.message}`);
    }
  };

  const handleDeleteUser = async (username: string) => {
    try {
      const { api } = await import("./utils/api");
      await api.deleteUser(username);
      setUsers((prev) => prev.filter((u) => u.username !== username));
      setSuccessMessage("User deleted successfully");
    } catch (error: any) {
      setError(`Failed to delete user: ${error.message}`);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setError(undefined);
    setSuccessMessage(undefined);
    try {
      const data = await parseScheduleExcel(file);
      // Persist to backend so DB is the source of truth
      await saveScheduleDataToBackend(data);
      // Reload from backend to ensure we're showing what's actually stored
      await loadScheduleData();
      // Reset filters when new data is loaded
      setSelectedProvider(undefined);
      setSelectedSite(undefined);
      setSuccessMessage(
        `Imported ${data.providers.length} providers, ${data.sites.length} sites, and ${data.schedules.length} schedule entries. Reloaded from database.`
      );
    } catch (err) {
      setError(
        "Failed to parse Excel file. Please check the file format and ensure it matches the expected structure."
      );
      console.error("Error parsing file:", err);
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

  const handleLogin = async (user: {
    username: string;
    role: UserRole;
    providerId?: string | null;
    siteId?: string | null;
  }) => {
    setAuth({
      isAuthenticated: true,
      username: user.username,
      role: user.role,
      providerId: user.providerId,
      siteId: user.siteId,
    });
    await loadScheduleData();
  };
  const handleLogout = () => {
    setAuth({
      isAuthenticated: false,
      username: "",
      role: undefined,
      providerId: undefined,
      siteId: undefined,
    });
    // Do NOT clear scheduleData here; keep it loaded for next login
  };

  // Loads schedule data from backend
  const loadScheduleData = async () => {
    try {
      const { api } = await import("./utils/api");
      const [providers, sites, schedules] = await Promise.all([
        api.getProviders(),
        api.getSites(),
        api.getSchedules(),
      ]);
      // Convert API data back to frontend format
      const convertedSchedules = schedules.map((s) => ({
        id: s.id,
        providerId: s.providerId,
        siteId: s.siteId,
        date: new Date(s.date + "T00:00:00"),
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status as "scheduled" | "confirmed" | "cancelled",
        notes: s.notes || "",
      }));
      setScheduleData({ providers, sites, schedules: convertedSchedules });
    } catch (err) {
      setError("Failed to load schedule data from backend.");
      console.error("Error loading schedule data:", err);
    }
  };

  // Saves parsed schedule data to backend in bulk
  const saveScheduleDataToBackend = async (data: ScheduleData) => {
    const { api } = await import("./utils/api");
    // Reset DB state so it's a clean import (users unaffected)
    await api.resetSchedule();
    // Upsert providers and sites
    await api.bulkProviders(
      data.providers.map((p) => ({ id: p.id, name: p.name }))
    );
    await api.bulkSites(data.sites.map((s) => ({ id: s.id, name: s.name })));
    // Upsert schedules (dates as YYYY-MM-DD)
    await api.bulkSchedules(
      data.schedules.map((s) => ({
        id: s.id,
        providerId: s.providerId,
        siteId: s.siteId,
        date: (s.date instanceof Date ? s.date : new Date(s.date))
          .toISOString()
          .slice(0, 10),
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        notes: s.notes || "",
      }))
    );
  };

  // Loads users from backend
  const loadUsers = async () => {
    try {
      const { api } = await import("./utils/api");
      const apiUsers = await api.getUsers();
      // Convert API users to UserAccount format (password is not returned by API for security)
      const convertedUsers = apiUsers.map((u) => ({
        username: u.username,
        password: "", // Password not returned by API
        role: u.role,
        providerId: u.providerId || undefined,
        siteId: u.siteId || undefined,
      }));
      setUsers(convertedUsers);
    } catch (err) {
      setError("Failed to load users from backend.");
      console.error("Error loading users:", err);
    }
  };

  // Load users when component mounts (for admin)
  useEffect(() => {
    if (auth.isAuthenticated && auth.role === "admin") {
      loadUsers();
    }
  }, [auth.isAuthenticated, auth.role]);

  // Periodically refresh schedules from DB while authenticated
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    // Initial load to ensure fresh data after login
    loadScheduleData();
    const id = setInterval(() => {
      loadScheduleData();
    }, 30000); // every 30s
    return () => clearInterval(id);
  }, [auth.isAuthenticated]);

  if (!auth.isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (auth.role === "physician") {
    // Find provider object for logged-in physician
    let provider: Provider | undefined = undefined;
    if (auth.providerId) {
      provider = scheduleData.providers.find((p) => p.id === auth.providerId);
    }
    // Fallback to username matching if providerId isn't set or not found
    if (!provider) {
      provider = scheduleData.providers.find(
        (p) => p.name.toLowerCase() === auth.username.toLowerCase()
      );
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
        <div
          style={{
            background: "#f8f8e0",
            border: "1px solid #ccc",
            padding: 10,
            margin: "10px 0",
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          <b>My Account Debug:</b>
          <br />
          Username: <code>{auth.username}</code>
          <br />
          ProviderId: <code>{auth.providerId || "Not set"}</code>
          <br />
          Matched Provider:{" "}
          <code>
            {provider ? provider.name + " (" + provider.id + ")" : "None"}
          </code>
        </div>
        <PhysicianView
        provider={provider}
        scheduleData={scheduleData}
        username={auth.username}
        onLogout={handleLogout}
      />
      </>
    );
  }

  

  if (auth.role === 'hospital') {
    // Find site object for logged-in hospital user
    let site: Site | undefined = undefined;
    if (auth.siteId) {
      site = scheduleData.sites.find((s) => s.id === auth.siteId);
    }
    // Fallback to username matching if siteId isn't set or not found
    if (!site) {
      site = scheduleData.sites.find(
        (s) => s.name.toLowerCase() === auth.username.toLowerCase()
      );
    }
    if (!site) {
      return (
        <div className="unauthorized">
          <h2>No Site Record</h2>
          <p>Your account is not linked to a site in the schedule data.</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      );
    }
    return (
      <>
        <div
          style={{
            background: "#f8f8e0",
            border: "1px solid #ccc",
            padding: 10,
            margin: "10px 0",
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          <b>My Account Debug:</b>
          <br />
          Username: <code>{auth.username}</code>
          <br />
          SiteId: <code>{auth.siteId || "Not set"}</code>
          <br />
          Matched Site:{" "}
          <code>{site ? site.name + " (" + site.id + ")" : "None"}</code>
        </div>
        <HospitalView
          site={site}
          scheduleData={scheduleData}
          onLogout={handleLogout}
        />
      </>
    );
  }

  if (auth.role !== "admin") {
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
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
        <nav className="admin-tabs" style={{ marginTop: 20 }}>
          <button
            onClick={() => setAdminTab("calendar")}
            className={`admin-tab ${
              adminTab === "calendar" ? "admin-tab--active" : ""
            }`}
            style={{ marginRight: 0 }}
          >
            Calendar
          </button>
         
          <button
            onClick={() => setAdminTab("users")}
            className={`admin-tab ${
              adminTab === "users" ? "admin-tab--active" : ""
            }`}
          >
            User Management
          </button>
          <button
            onClick={() => setAdminTab("addSchedule")}
            className={`admin-tab ${
              adminTab === "addSchedule" ? "admin-tab--active" : ""
            }`}
          >
            Add Schedule
          </button>
          <button
            onClick={() => setAdminTab("analytics")}
            className={`admin-tab ${
              adminTab === "analytics" ? "admin-tab--active" : ""
            }`}
          >
            Analytics Setup
          </button>
        </nav>
      </header>
      <main className="App-main">
        {adminTab === "users" ? (
          <UserManagement
            users={users}
            providers={scheduleData.providers}
            sites={scheduleData.sites}
            onAdd={handleAddUser}
            onEdit={handleEditUser}
            onDelete={handleDeleteUser}
          />
        ) : adminTab === "addSchedule" ? (
          <AddSchedule />
        ) : adminTab === "analytics" ? (
          <AdminAnalyticsUpload />
        ) : (
          <>
            <div className="action-row">
              <button className="btn btn-outline" onClick={loadScheduleData}>
                Reload from database
              </button>
            </div>
            {error && <div className="error-message">{error}</div>}
            {successMessage && (
              <div className="success-message">{successMessage}</div>
            )}
            {isLoading && (
              <div className="loading-message">Loading schedule data...</div>
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
