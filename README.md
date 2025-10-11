# Scheduler
### To start the frontend:
```bash
cd frontend
npm install
npm start
```

### To start the backend (or at least the database server):
```bash
cd backend
npm install
npm run seed
npm run dev
```

The database is currently SQLite. To access from DBeaver, create a new SQLite connection and connect by host. Click Open and choose `backend/data.sqlite` from the directory where you cloned the repo.