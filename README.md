# Smart To-Do List Management System

A production-ready, highly interactive full-stack **Smart To-Do List** application built with Node.js, Express, HTML5, Vanilla CSS, and Vanilla JavaScript, with support for MySQL and SQLite.

## 🚀 Key Features

1. **Secure Session Authentication**: Registration and Login using JWT token stored in HTTP-only cookies, secured by `bcryptjs` password hashing.
2. **Task CRUD Operations**: Add, Edit, Delete, and Complete tasks with titles, descriptions, categories, priorities (High, Medium, Low), and due date/times.
3. **Persisted Drag-and-Drop Reordering**: Rearrange cards using native HTML5 drag-and-drop. Positions are recalculated and saved to the database.
4. **Circular Progress Analytics**: Real-time stats counting Total, Completed, Pending, and Overdue tasks, complete with an animated radial circular SVG tracker.
5. **Dynamic Filters, Sorts & Live Search**:
   - Filter by status, priority, and categories.
   - Sort by due date, creation date, priority (High > Medium > Low custom sequence), and title.
   - Live debounced search queries matching titles, descriptions, and category tags.
6. **Task Activity Logger**: Side-out panel displaying logs of recent task changes (creating, completing, deleting, updating).
7. **CSV & PDF Manifest Exports**:
   - Generate and download CSV tables locally.
   - Clean, formatted printable templates that allow users to save active tasks to PDF seamlessly via standard browser printing (`Ctrl+P`).
8. **Deadline Alerts & Web Notifications**: Scans task deadlines. Tasks due in under 15 minutes trigger Toast warnings and native desktop notifications.
9. **Dark Mode Theme Switcher**: Toggle theme settings saved to `localStorage` changing root CSS variables.

---

## 🛠️ Tech Stack & Setup

* **Frontend**: HTML5, CSS Variables, Vanilla JS (No heavy framework dependencies)
* **Backend**: Node.js & Express.js
* **Database Drivers**: `mysql2/promise` & `sqlite3`

### 1. Pre-requisites
- **Node.js** (v18+)
- **MySQL Server** (Optional: falls back to SQLite automatically if omitted)

### 2. Workspace Recommendation
Open settings and set the active coding workspace to:
```text
C:\Users\dipik\.gemini\antigravity\scratch\smart-todo-system
```

### 3. Project Configuration
Copy `.env.example` to a new file named `.env`:
```bash
cp .env.example .env
```
Inside `.env`, configure the server port, secret keys, and database connection.

> [!TIP]
> **Zero-Configuration Setup (SQLite)**
> If you leave `DB_HOST`, `DB_USER`, and `DB_NAME` blank in your `.env` file, the backend will automatically initialize a local SQLite file named `todo.db` in the project root.
> It creates the tables and loads the default categories (`Personal`, `Work`, `Academic`, `Health`, `Others`) automatically.

---

## 💻 Running the Application

1. Make sure node dependencies are installed:
   ```bash
   npm install
   ```
2. Start the application:
   ```bash
   npm start
   ```
3. Open your browser and navigate to:
   ```text
   http://localhost:3000
   ```

---

## 📂 Project Architecture

```
smart-todo-system/
├── src/
│   ├── config/
│   │   └── database.js       # MySQL Pool & SQLite connection fallback wrapper
│   ├── middleware/
│   │   ├── auth.js           # JWT verification in cookies
│   │   └── validation.js     # User and Task input validators
│   ├── routes/
│   │   ├── auth.js           # /api/auth (Login, Register, Logout, Session check)
│   │   ├── tasks.js          # /api/tasks (CRUD, Reorder, Search, Filter, Stats, Logs)
│   │   └── categories.js     # /api/categories (CRUD)
│   ├── public/               # Frontend Client Files
│   │   ├── css/
│   │   │   └── styles.css    # Responsive styles, glassmorphism, transitions
│   │   ├── js/
│   │   │   ├── api.js        # REST client
│   │   │   └── app.js        # UI engine, Drag & Drop, alerts, charts
│   │   └── index.html        # App layout
│   └── server.js             # Server bootstrap
├── .env.example
├── schema.sql
├── package.json
└── README.md
```

## 🔐 Security Protections Implemented
- **Password Protection**: Hashed passwords using 10-round bcrypt.
- **JWT Protection**: HTTP-only, `sameSite` cookies blocking XSS and CSRF.
- **SQL Injection Safeguard**: Fully parameterized query statements across MySQL & SQLite query routes.
- **Sanitized Inputs**: Escaped HTML tags inside JavaScript rendering methods.
