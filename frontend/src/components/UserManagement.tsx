
import React, { useState } from 'react';
import { Provider, Site } from './types/schedule';

export type UserRole = 'admin' | 'physician' | 'hospital';

export interface UserAccount {
  username: string;
  password: string;
  role: UserRole;
  providerId?: string; // Only for physicians
  siteId?: string; // Only for hospital users
}


interface UserManagementProps {
  users: UserAccount[];
  providers: Provider[];
  sites: Site[];
  onAdd: (user: UserAccount) => void;
  onEdit: (user: UserAccount) => void;
  onDelete: (username: string) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ users, providers, sites, onAdd, onEdit, onDelete }) => {
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [newUser, setNewUser] = useState<UserAccount>({ username: '', password: '', role: 'physician', providerId: '', siteId: '' });

  const handleEdit = (user: UserAccount) => setEditing(user);
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!editing) return;
    setEditing({ ...editing, [e.target.name]: e.target.value });
  };
  const handleEditSave = () => {
    if (editing) onEdit(editing);
    setEditing(null);
  };

  const handleAddChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewUser({ ...newUser, [e.target.name]: e.target.value });
  };
  const handleAdd = () => {
    if (!newUser.username || !newUser.password) return;
    if (newUser.role === 'physician' && !newUser.providerId) return;
    if (newUser.role === 'hospital' && !newUser.siteId) return;
    onAdd(newUser);
    setNewUser({ username: '', password: '', role: 'physician', providerId: '', siteId: '' });
  };

  return (
    <div className="user-management">
      <h2 className="um-title">User Accounts</h2>
      <table className="um-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Role</th>
            <th>Password</th>
            <th>Provider</th>
            <th>Site</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.username}>
              <td>{editing?.username === user.username ? (
                <input className="um-input" name="username" value={editing.username} onChange={handleEditChange} />
              ) : user.username}</td>
              <td>{editing?.username === user.username ? (
                <select className="um-select" name="role" value={editing.role} onChange={handleEditChange}>
                  <option value="admin">admin</option>
                  <option value="physician">physician</option>
                  <option value="hospital">hospital</option>
                </select>
              ) : user.role}</td>
              <td>{editing?.username === user.username ? (
                <input className="um-input" name="password" value={editing.password} onChange={handleEditChange} type="password" />
              ) : '••••••'}</td>
              <td>{editing?.username === user.username && editing.role === 'physician' ? (
                <select className="um-select" name="providerId" value={editing.providerId || ''} onChange={handleEditChange}>
                  <option value="">-- Select Provider --</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : user.role === 'physician' ? (
                providers.find(p => p.id === user.providerId)?.name || <span className="um-chip-muted">Not linked</span>
              ) : '-'}</td>
              <td>{editing?.username === user.username && editing.role === 'hospital' ? (
                <select className="um-select" name="siteId" value={editing.siteId || ''} onChange={handleEditChange}>
                  <option value="">-- Select Site --</option>
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              ) : user.role === 'hospital' ? (
                sites.find(s => s.id === user.siteId)?.name || <span className="um-chip-muted">Not linked</span>
              ) : '-'}</td>
              <td>
                {editing?.username === user.username ? (
                  <>
                    <button className="um-btn um-btn-primary" onClick={handleEditSave}>Save</button>
                    <button className="um-btn um-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="um-btn um-btn-primary" onClick={() => handleEdit(user)}>Edit</button>
                    <button className="um-btn um-btn-danger" onClick={() => onDelete(user.username)}>Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          <tr>
            <td><input className="um-input" name="username" value={newUser.username} onChange={handleAddChange} /></td>
            <td>
              <select className="um-select" name="role" value={newUser.role} onChange={handleAddChange}>
                <option value="admin">admin</option>
                <option value="physician">physician</option>
                <option value="hospital">hospital</option>
              </select>
            </td>
            <td><input className="um-input" name="password" value={newUser.password} onChange={handleAddChange} type="password" /></td>
            <td>{newUser.role === 'physician' ? (
              <select className="um-select" name="providerId" value={newUser.providerId || ''} onChange={handleAddChange}>
                <option value="">-- Select Provider --</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ) : '-'}</td>
            <td>{newUser.role === 'hospital' ? (
              <select className="um-select" name="siteId" value={newUser.siteId || ''} onChange={handleAddChange}>
                <option value="">-- Select Site --</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : '-'}</td>
            <td><button className="um-btn um-btn-primary" onClick={handleAdd}>Add</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  );

};

export default UserManagement;
