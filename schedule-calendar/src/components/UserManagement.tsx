
import React, { useState } from 'react';
import { Provider } from '../types/schedule';

export type UserRole = 'admin' | 'physician';

export interface UserAccount {
  username: string;
  password: string;
  role: UserRole;
  providerId?: string; // Only for physicians
}


interface UserManagementProps {
  users: UserAccount[];
  providers: Provider[];
  onAdd: (user: UserAccount) => void;
  onEdit: (user: UserAccount) => void;
  onDelete: (username: string) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ users, providers, onAdd, onEdit, onDelete }) => {
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [newUser, setNewUser] = useState<UserAccount>({ username: '', password: '', role: 'physician', providerId: '' });

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
    onAdd(newUser);
    setNewUser({ username: '', password: '', role: 'physician', providerId: '' });
  };

  return (
    <div className="user-management">
      <h2>User Accounts</h2>
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Role</th>
            <th>Password</th>
            <th>Provider</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.username}>
              <td>{editing?.username === user.username ? (
                <input name="username" value={editing.username} onChange={handleEditChange} />
              ) : user.username}</td>
              <td>{editing?.username === user.username ? (
                <select name="role" value={editing.role} onChange={handleEditChange}>
                  <option value="admin">admin</option>
                  <option value="physician">physician</option>
                </select>
              ) : user.role}</td>
              <td>{editing?.username === user.username ? (
                <input name="password" value={editing.password} onChange={handleEditChange} type="password" />
              ) : '••••••'}</td>
              <td>{editing?.username === user.username && editing.role === 'physician' ? (
                <select name="providerId" value={editing.providerId || ''} onChange={handleEditChange}>
                  <option value="">-- Select Provider --</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : user.role === 'physician' ? (
                providers.find(p => p.id === user.providerId)?.name || <span style={{color:'#aaa'}}>Not linked</span>
              ) : '-'}</td>
              <td>
                {editing?.username === user.username ? (
                  <>
                    <button onClick={handleEditSave}>Save</button>
                    <button onClick={() => setEditing(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleEdit(user)}>Edit</button>
                    <button onClick={() => onDelete(user.username)}>Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          <tr>
            <td><input name="username" value={newUser.username} onChange={handleAddChange} /></td>
            <td>
              <select name="role" value={newUser.role} onChange={handleAddChange}>
                <option value="admin">admin</option>
                <option value="physician">physician</option>
              </select>
            </td>
            <td><input name="password" value={newUser.password} onChange={handleAddChange} type="password" /></td>
            <td>{newUser.role === 'physician' ? (
              <select name="providerId" value={newUser.providerId || ''} onChange={handleAddChange}>
                <option value="">-- Select Provider --</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ) : '-'}</td>
            <td><button onClick={handleAdd}>Add</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default UserManagement;
