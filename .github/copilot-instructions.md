# SF Migrator - GitHub Copilot Instructions

> **Purpose**: Comprehensive development guide for LLMs and developers working on the SF Migrator project.
> This document contains all architectural patterns, conventions, and best practices for efficient code generation and understanding.

---

## 📋 Table of Contents

1. [Critical Rules & References](#-critical-rules--references)
2. [Project Overview](#-project-overview)
3. [Architecture & Layers](#-architecture--layers)
4. [Development Setup](#-development-setup)
5. [Backend Patterns](#-backend-patterns)
6. [Frontend Patterns](#-frontend-patterns)
7. [API Design & Routing](#-api-design--routing)
8. [Authentication & Security](#-authentication--security)
9. [Database & Models](#-database--models)
10. [Salesforce Integration](#-salesforce-integration)
11. [Logging & Debugging](#-logging--debugging)
12. [Configuration & Environments](#-configuration--environments)
13. [Code Style & Conventions](#-code-style--conventions)
14. [Common Tasks & Operations](#-common-tasks--operations)
15. [Troubleshooting & Gotchas](#-troubleshooting--gotchas)

---

## 🚨 Critical Rules & References

### MUST READ BEFORE ANY OPERATION

#### 1. Architecture Documentation
**BEFORE any code operation:**
- **ALWAYS read `SERVER/docs/ARCHITECTURE.md` FIRST** to understand the current system architecture
- Understand which layers are affected: middleware → routes → services → repositories → models
- Follow established patterns: repository pattern, service orchestration, action-based routing
- Never bypass layers (e.g., don't query models directly from routes)

**AFTER any architectural change:**
- **ALWAYS update `SERVER/docs/ARCHITECTURE.md`** to reflect changes
- Document new patterns, layers, or architectural decisions
- Update code examples if patterns have changed
- Keep documentation in sync with implementation

**Architecture changes include:**
- Adding/removing/modifying services, repositories, middleware, or routes
- Changing request/response patterns or error handling
- Adding new layers or cross-cutting concerns
- Modifying authentication, logging, or configuration approaches

#### 2. Salesforce Integration
**When working with Salesforce connections or `salesforceService.js`:**
- **ALWAYS reference `SERVER/docs/JSFORCE_REFERENCE.md` FIRST**
- This document contains curated jsforce patterns and best practices
- Do not guess or assume jsforce API behavior

**Key Rules:**
- Use **Username-Password with OAuth2** (Pattern 2 in JSFORCE_REFERENCE.md) for all connections
- Always include `clientId` and `clientSecret` in OAuth2 config
- Concatenate `password + securityToken` when calling `conn.login()`
- Use correct `loginUrl`: `https://login.salesforce.com` (production) or `https://test.salesforce.com` (sandbox)
- Never use instance URLs as loginUrl
- **Avoid Client Credentials flow** - it doesn't support session refresh and fails with REST API
- Use connection pooling (already implemented in `salesforceService.js`)

#### 3. Database Model Changes
**⚠️ IMPORTANT:** The database schema is subject to change. Do not write code that makes rigid assumptions about:
- Specific table structures or column names
- Relationships between models (except core: User → Project → SfOrg)
- Migration-related tables (these may be refactored)

Always use repository methods to abstract database access.

#### 4. Feature Development
**Note:** Certain features are under active development:
- Migration workspace views and components (structure may change)
- Metadata analysis flow (being enhanced)
- Field mapping UI (in progress)

Check `SERVER/docs/ARCHITECTURE.md` for current implementation status before modifying these areas.

---

## 🎯 Project Overview

**SF Migrator** is a full-stack web application for managing and executing Salesforce data migrations between orgs.

### Tech Stack

#### Frontend
- **Framework**: Vue 3.4.34 with Composition API (`<script setup>`)
- **Build Tool**: Vite 6.3.5 (dev server on port 5173)
- **UI Library**: PrimeVue 4.3.3 (PrimeFlex + Aura theme)
- **State Management**: Pinia 3.0.2 with persistence (`pinia-plugin-persistedstate`)
- **Routing**: Vue Router 4.4.0 with navigation guards
- **HTTP Client**: Axios 1.8.4 (custom instance with interceptors)
- **Styling**: SCSS + TailwindCSS 3.4.6 with PrimeUI plugin
- **Icons**: PrimeIcons 7.0.0

#### Backend
- **Runtime**: Node.js (Express 4.21.2)
- **API Framework**: Express with custom action-based routing
- **ORM**: Sequelize 6.37.7 (PostgreSQL)
- **Database**: PostgreSQL with UUID primary keys
- **Salesforce SDK**: jsforce 3.6.5
- **Authentication**: JWT (jsonwebtoken 9.0.2) in HttpOnly cookies
- **Password Hashing**: bcrypt 6.0.0
- **Process Manager**: nodemon (dev), cross-env for NODE_ENV

#### Development Tools
- **Linting**: ESLint with Vue plugin
- **Formatting**: Prettier 3.2.5
- **Database CLI**: sequelize-cli 6.6.3
- **Environment**: dotenv 16.4.7

### Project Structure

```
sf-migrator/
├── .github/
│   └── copilot-instructions.md          # This file
├── src/                                 # Frontend (Vue 3)
│   ├── main.js                          # App entry point
│   ├── App.vue                          # Root component
│   ├── api/
│   │   └── axiosInstance.js             # Configured Axios with interceptors
│   ├── assets/                          # Styles, images, logos
│   │   └── styles.scss                  # Global SCSS imports
│   ├── components/                      # Reusable Vue components
│   │   ├── dashboard/                   # Dashboard-specific components
│   │   ├── AddOrgDialog.vue
│   │   ├── AddProjectDialog.vue
│   │   └── EditOrgDialog.vue
│   ├── composables/
│   │   └── auth/
│   │       └── useAuth.js               # Auth composable (login, isLoggedIn)
│   ├── layout/
│   │   ├── AppLayout.vue                # Main layout wrapper
│   │   ├── AppTopbar.vue
│   │   └── AppFooter.vue
│   ├── router/
│   │   └── index.js                     # Vue Router config with guards
│   ├── stores/                          # Pinia stores
│   │   ├── userStore.js                 # User auth state
│   │   ├── orgStore.js                  # Projects, orgs, selections
│   │   ├── metadataStore.js
│   │   ├── mappingStore.js
│   │   └── globalStore.js
│   └── views/                           # Page-level components
│       ├── Dashboard.vue
│       └── pages/
│           └── auth/
│               ├── Login.vue
│               └── Register.vue
├── SERVER/                              # Backend (Express + Sequelize)
│   ├── config/
│   │   └── config.js                    # Database config per environment
│   ├── docs/                            # Architecture documentation
│   │   ├── ARCHITECTURE.md              # ⚠️ READ THIS FIRST
│   │   ├── JSFORCE_REFERENCE.md         # Salesforce API patterns
│   │   ├── STARTUP_GUIDE.md
│   │   └── ENVIRONMENT_SETUP.md
│   ├── migrations/                      # Sequelize migrations
│   ├── models/                          # Sequelize models
│   │   ├── index.js                     # Auto-loader
│   │   ├── User.js
│   │   ├── Project.js
│   │   ├── SfOrg.js
│   │   ├── SfObjectMetadata.js
│   │   ├── SfFieldMetadata.js
│   │   ├── ObjectMapping.js
│   │   └── FieldMapping.js
│   ├── scripts/
│   │   └── db/
│   │       └── queries.sql              # ⚠️ Database setup instructions
│   ├── seeders/                         # Sequelize seed files
│   ├── src/
│   │   ├── server.js                    # Express app entry point
│   │   ├── lib/
│   │   │   └── logger.js                # Structured logger with AsyncLocalStorage
│   │   ├── middleware/
│   │   │   ├── requestTracer.js         # Request ID generation
│   │   │   └── authMiddleware.js        # JWT validation
│   │   ├── routes/
│   │   │   ├── auth.js                  # Authentication routes
│   │   │   ├── api.js                   # Action-based API routes
│   │   │   └── validator.js             # Input validation utilities
│   │   ├── services/                    # Business logic layer
│   │   │   ├── salesforceService.js     # jsforce connection & API calls
│   │   │   ├── metadataService.js       # Metadata orchestration
│   │   │   ├── analysisService.js
│   │   │   ├── config/
│   │   │   │   └── objectsToExclude.js  # Salesforce object filters
│   │   │   └── queries/
│   │   │       ├── restAPIqueries.js    # Salesforce REST API queries
│   │   │       └── toolingAPIqueries.js # Salesforce Tooling API queries
│   │   ├── repositories/                # Data access layer
│   │   │   ├── userRepository.js
│   │   │   ├── projectRepository.js
│   │   │   ├── orgRepository.js
│   │   │   ├── metadataRepository.js
│   │   │   ├── mappingRepository.js
│   │   │   └── analysisRepository.js
│   │   └── utils/
│   │       ├── sendResponse.js          # Standardized response helper
│   │       └── parseCookies.js          # Cookie parsing utility
├── public/                              # Static assets
├── index.html                           # Vite entry HTML
├── package.json                         # Frontend dependencies & scripts
├── vite.config.mjs                      # Vite configuration
├── tailwind.config.js                   # TailwindCSS configuration
├── postcss.config.js                    # PostCSS configuration
├── startDevServers.ps1                  # PowerShell script to start both servers
└── README.md                            # Basic setup instructions
```

---

## 🏗 Architecture & Layers

### Layered Architecture Pattern

The backend follows **strict layer separation** with unidirectional dependencies:

```
HTTP Request
    ↓
Middleware Layer (requestTracer, authMiddleware)
    ↓
Routes Layer (action-based routing)
    ↓
Services Layer (business logic orchestration)
    ↓
Repository Layer (ONLY layer that touches Sequelize models)
    ↓
Models Layer (Sequelize ORM)
    ↓
PostgreSQL Database
```

### Layer Responsibilities

#### 1. Middleware Layer (`SERVER/src/middleware/`)
**Purpose**: Cross-cutting concerns applied to all/many requests

**Components**:
- `requestTracer.js`: Generates unique `X-Request-ID` for each request, stores in AsyncLocalStorage for logging
- `authMiddleware.js`: Validates JWT from cookie, attaches `req.user` to request object

**Key Pattern**:
```javascript
app.use(express.json());
app.use(requestTracer);              // All requests
app.use(cors(options));
app.use('/auth', authRoutes);        // Public routes
app.use('/', authMiddleware, apiRoutes);  // Protected routes
```

#### 2. Routes Layer (`SERVER/src/routes/`)
**Purpose**: Define HTTP endpoints, validate headers, delegate to services

**Components**:
- `auth.js`: Public authentication routes (`/auth/login`, `/auth/register`, `/auth/whoami`)
- `api.js`: All protected API operations via action-based routing
- `validator.js`: Input validation utilities (email, password, username)

**Responsibilities**:
- Parse `action` header and route to appropriate handler
- Call service/repository methods
- Return responses using `sendResponse()` utility
- Handle errors and log them
- **NEVER query models directly** - always use repositories

#### 3. Services Layer (`SERVER/src/services/`)
**Purpose**: Orchestrate complex operations involving multiple repositories or external APIs

**Components**:
- `salesforceService.js`: Salesforce connection management, API calls via jsforce
  - Connection pooling
  - OAuth2 authentication
  - Metadata retrieval (describeGlobal, describeObject)
  - Record counts
- `metadataService.js`: Orchestrates metadata analysis flow
  - Calls salesforceService to fetch metadata
  - Applies filters (user preferences + hardcoded exclusions)
  - Saves to database via metadataRepository
- `analysisService.js`: Analysis workflow orchestration

**Key Pattern**:
```javascript
// Service orchestrates multiple repositories and external APIs
async function analyzeAndSaveOrg(sfOrgId, options = {}) {
  // 1. Fetch from external API
  const objects = await salesforceService.describeGlobal(sfOrgId);
  
  // 2. Apply business logic
  const filtered = applyFilters(objects, options);
  
  // 3. Save via repository
  for (const obj of filtered) {
    const details = await salesforceService.describeObject(sfOrgId, obj.objectName);
    await metadataRepository.saveObjectMetadata(sfOrgId, details);
  }
  
  return result;
}
```

#### 4. Repository Layer (`SERVER/src/repositories/`)
**Purpose**: Abstract all database access. **ONLY layer that directly touches Sequelize models.**

**Components**:
- `userRepository.js`: User CRUD operations
- `projectRepository.js`: Project CRUD operations
- `orgRepository.js`: SfOrg CRUD operations
- `metadataRepository.js`: Object/Field metadata CRUD operations
- `mappingRepository.js`: Object and field mapping CRUD operations
- `analysisRepository.js`: Analysis tracking

**Key Principles**:
- All functions are `async`
- Use Sequelize methods: `findByPk`, `findAll`, `findOne`, `create`, `update`, `destroy`
- Return plain data (models are auto-serialized)
- Handle database errors (throw descriptive errors)
- Include necessary associations using `include` option
- Log significant operations using structured logger

**Pattern**:
```javascript
const { Project } = require('../../models');
const logger = require('../lib/logger');
const log = logger.create('projectRepository');

async function findByUserId(userId) {
    return Project.findAll({ where: { userId } });
}

async function create(projectData) {
    const project = await Project.create(projectData);
    log.info('Project created', { projectId: project.id, name: project.name });
    return project;
}

module.exports = { findByUserId, create, /* ... */ };
```

#### 5. Models Layer (`SERVER/models/`)
**Purpose**: Define database schema and relationships using Sequelize

**Key Points**:
- All models auto-loaded by `models/index.js`
- Use UUID primary keys (`DataTypes.UUIDV4`)
- Define associations in `Model.associate(models)` function
- Use custom validators for complex validation logic
- Export via `module.exports` (CommonJS)

**Pattern**:
```javascript
module.exports = (sequelize, DataTypes) => {
    const Project = sequelize.define('Project', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'Users', key: 'id' }
        },
    });

    Project.associate = function(models) {
        Project.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    };

    return Project;
};
```

### Why This Architecture?

✅ **Separation of Concerns**: Each layer has a single, well-defined responsibility
✅ **Testability**: Easy to mock repositories or services in isolation
✅ **Maintainability**: Changes in one layer don't cascade to others
✅ **Scalability**: Easy to add caching, logging, or swap database implementations
✅ **Clarity**: Clear data flow makes debugging easier

---

## 🚀 Development Setup

### Prerequisites
- **Node.js** v18 or higher
- **PostgreSQL** 13+ (running on port 5432)
- **npm** (comes with Node.js)
- **Git** (for version control)

### Database Setup

**Complete setup instructions**: See `SERVER/scripts/db/queries.sql`

**Quick Setup**:
1. Ensure PostgreSQL is running
2. Connect as `postgres` superuser
3. Execute the SQL commands in `queries.sql` to:
   - Create role `sf_migrator` with password
   - Create custom tablespace `ts_sf_migrator`
   - Create databases: `sf_migrator_dev`, `sf_migrator_test`, `sf_migrator_prod`

**Database Configuration**:
Edit `SERVER/config/config.js` with your database credentials:
```javascript
const development = {
    username: process.env.DB_USER || 'sf_migrator',
    password: process.env.DB_PASSWORD || '1199',
    database: process.env.DB_NAME || 'sf_migrator_dev',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    logging: false,
    schema: process.env.DB_SCHEMA || 'public'
};
```

### Installation

```powershell
# Install frontend dependencies
npm install

# Install backend dependencies
cd SERVER
npm install
cd ..
```

### Running Migrations & Seeds

```powershell
cd SERVER

# Run migrations (creates tables)
npm run migrate:dev

# Seed database (creates sample users, projects, orgs)
npm run seed:dev

# Fresh setup (undo all, migrate, seed)
npm run fresh:dev
```

**Available npm scripts** (from `SERVER/package.json`):
- `npm run start:dev` - Start backend with nodemon (auto-reload)
- `npm run start:test` - Start backend in test mode
- `npm run start:prod` - Start backend in production mode
- `npm run migrate:dev` - Run pending migrations (development)
- `npm run migrate:status:dev` - Check migration status
- `npm run seed:dev` - Seed database (development)
- `npm run fresh:dev` - Undo migrations, migrate, seed (fresh start)

### Starting the Application

#### Option 1: PowerShell Script (Recommended for Windows)
```powershell
powershell.exe .\startDevServers.ps1
```
This starts both frontend and backend in separate terminal windows.

#### Option 2: Manual Start (Two separate terminals)

**Terminal 1 - Backend:**
```powershell
cd SERVER
npm run start:dev
```
Backend runs on: **http://localhost:3000**

**Terminal 2 - Frontend:**
```powershell
npm run dev
```
Frontend runs on: **http://localhost:5173**

#### Verify Setup
1. Open browser to http://localhost:5173
2. You should see the login page
3. Use seeded credentials (check seeders for details)

### Environment Files

Create environment-specific files in `SERVER/` directory:

**`SERVER/.env.development`**:
```env
NODE_ENV=development
PORT=3000
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRATION=12h
FRONTEND_URL=http://localhost:5173
DB_USER=sf_migrator
DB_PASSWORD=1199
DB_NAME=sf_migrator_dev
DB_HOST=127.0.0.1
DB_SCHEMA=public
DB_LOGGING=false
```

**`SERVER/.env.test`**:
```env
NODE_ENV=test
# ... similar to development
```

**`SERVER/.env.production`**:
```env
NODE_ENV=production
# ... use secure credentials
```

**Note**: Environment files are loaded in `SERVER/config/config.js` and `SERVER/src/server.js`

---

## 🔧 Backend Patterns

### Repository Pattern (Data Access Layer)

**Rule**: Repositories are the **ONLY** place to interact with Sequelize models.

**Structure**:
```javascript
// userRepository.js
const { User } = require('../../models');
const logger = require('../lib/logger');
const log = logger.create('userRepository');

async function findById(id) {
    return User.findByPk(id);
}

async function findByEmail(email) {
    return User.findOne({ where: { email } });
}

async function create(userData) {
    const user = await User.create(userData);
    log.info('User created', { userId: user.id, email: user.email });
    return user;
}

async function update(id, updates) {
    const user = await User.findByPk(id);
    if (!user) throw new Error('User not found');
    const updated = await user.update(updates);
    log.info('User updated', { userId: id });
    return updated;
}

async function remove(id) {
    const user = await User.findByPk(id);
    if (!user) throw new Error('User not found');
    await user.destroy();
    log.info('User deleted', { userId: id });
}

module.exports = {
    findById,
    findByEmail,
    create,
    update,
    delete: remove,
};
```

**Why export `delete: remove`?**  
`delete` is a reserved keyword in JavaScript, so we name the function `remove` and export it as `delete`.

### Service Orchestration Pattern

**Rule**: Services orchestrate business logic by calling multiple repositories and external APIs.

**Example - metadataService.js**:
```javascript
const metadataRepo = require('../repositories/metadataRepository');
const salesforceService = require('./salesforceService');
const logger = require('../lib/logger');
const log = logger.create('metadataService');

async function analyzeAndSaveOrg(sfOrgId, options = {}) {
    // 1. Fetch from Salesforce
    const objects = await salesforceService.describeGlobal(sfOrgId);
    log.info('Retrieved objects from Salesforce', { count: objects.length });

    // 2. Apply business logic (filters)
    const filtered = applyFilters(objects, options);
    log.info('Filters applied', { count: filtered.length });

    // 3. Loop through objects, fetch details, save to DB
    const savedObjects = [];
    for (const obj of filtered) {
        const details = await salesforceService.describeObject(sfOrgId, obj.objectName);
        const recordCount = await salesforceService.getRecordCount(sfOrgId, obj.objectName);
        
        const saved = await metadataRepo.saveObjectMetadata(sfOrgId, {
            ...details,
            recordCount
        });
        
        savedObjects.push(saved);
    }

    return savedObjects;
}

module.exports = { analyzeAndSaveOrg };
```

### Response Standardization

**Rule**: Always use `sendResponse()` utility for API responses.

**Implementation** (`SERVER/src/utils/sendResponse.js`):
```javascript
function sendResponse(res, status, success, message, data = undefined) {
    const response = { success, message };
    if (data !== undefined) response.data = data;
    const requestId = res.getHeader('X-Request-ID');
    if (requestId) response.requestId = requestId;
    return res.status(status).json(response);
}

module.exports = sendResponse;
```

**Usage**:
```javascript
const sendResponse = require('../utils/sendResponse');

// Success with data
sendResponse(res, 200, true, 'Projects retrieved successfully', projects);

// Success without data
sendResponse(res, 200, true, 'Project deleted successfully');

// Error
sendResponse(res, 400, false, 'Project ID is required');
sendResponse(res, 500, false, 'Internal server error');
```

**Response Format**:
```json
{
  "success": true,
  "message": "Projects retrieved successfully",
  "data": [ /* ... */ ],
  "requestId": "a1b2c3d4"
}
```

### Error Handling Pattern

**In Routes**:
```javascript
router.get('/', authMiddleware, async (req, res) => {
    const action = req.headers.action?.toLowerCase();

    if (action === 'get-projects') {
        try {
            const projects = await projectRepo.findByUserId(req.user.id);
            sendResponse(res, 200, true, 'Projects retrieved successfully', projects);
        } catch (error) {
            log.error('Failed to retrieve projects', error, { userId: req.user.id });
            sendResponse(res, 500, false, 'Failed to retrieve projects');
        }
    }
    else {
        sendResponse(res, 400, false, 'Unknown action');
    }
});
```

**In Repositories** (throw descriptive errors):
```javascript
async function update(id, data) {
    const record = await Model.findByPk(id);
    if (!record) {
        throw new Error('Record not found');
    }
    return await record.update(data);
}
```

**In Services** (catch and re-throw with context):
```javascript
async function analyzeOrg(orgId) {
    try {
        const conn = await salesforceService.connectToOrg(orgId);
        return await salesforceService.describeGlobal(conn);
    } catch (error) {
        log.error('Failed to analyze org', error, { orgId });
        throw new Error(`Org analysis failed: ${error.message}`);
    }
}
```

---

## 🎨 Frontend Patterns

### Vue 3 Composition API (Script Setup)

**Rule**: All new components use `<script setup>` syntax.

**Basic Component Structure**:
```vue
<script setup>
import { ref, computed, onMounted } from 'vue';
import { useOrgStore } from '@/stores/orgStore';
import axiosInstance from '@/api/axiosInstance';

const orgStore = useOrgStore();
const projects = ref([]);
const loading = ref(false);

const filteredProjects = computed(() => {
    return projects.value.filter(p => p.name.includes('test'));
});

async function loadProjects() {
    loading.value = true;
    try {
        const response = await axiosInstance.get('/', {
            headers: { action: 'get-projects' }
        });
        if (response.data.success) {
            projects.value = response.data.data;
        }
    } catch (error) {
        console.error('Failed to load projects:', error);
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    loadProjects();
});
</script>

<template>
    <div>
        <ProgressSpinner v-if="loading" />
        <DataTable v-else :value="filteredProjects">
            <!-- columns -->
        </DataTable>
    </div>
</template>

<style scoped>
/* component-specific styles */
</style>
```

### PrimeVue Auto-Import

**PrimeVue components** are auto-imported via `unplugin-vue-components` configured in `vite.config.mjs`.

**No need to import PrimeVue components**:
```vue
<!-- ✅ Correct - no import needed -->
<template>
    <Button label="Click Me" @click="handleClick" />
    <Dialog v-model:visible="showDialog">
        <DataTable :value="data" />
    </Dialog>
</template>
```

**Still need to import**:
- Composables (`useToast`, `useConfirm`)
- Stores
- Axios instance
- Custom utilities

```vue
<script setup>
import { useToast } from 'primevue/usetoast';
import { useOrgStore } from '@/stores/orgStore';
import axiosInstance from '@/api/axiosInstance';

const toast = useToast();
const orgStore = useOrgStore();
</script>
```

### Pinia Store Pattern

**Stores** are in `src/stores/` and use **persistent state** via `pinia-plugin-persistedstate`.

**Store Structure** (`orgStore.js`):
```javascript
import { defineStore } from 'pinia';
import axiosInstance from '@/api/axiosInstance';

export const useOrgStore = defineStore('orgs', {
    
    persist: true,  // Enable persistence to localStorage
    
    state: () => ({
        projects: [],
        orgs: [],
        selectedProject: null,
        selectedOrg: null,
        showAddProjectDialog: false,
    }),
    
    getters: {
        // Computed property: orgs filtered by selected project
        projectOrgs: (state) => {
            if (!state.selectedProject) return [];
            return state.orgs.filter(org => org.projectId === state.selectedProject.id);
        },
    },
    
    actions: {
        setSelectedProject(project) {
            this.selectedProject = project;
            this.selectedOrg = null;  // Clear org when project changes
        },
        
        async loadProjects() {
            const response = await axiosInstance.get('/', {
                headers: { action: 'get-projects' }
            });
            if (response.data.success) {
                this.projects = response.data.data;
                await this.loadOrgs();  // Cascade load
            }
        },
        
        async loadOrgs() {
            const response = await axiosInstance.get('/', {
                headers: { action: 'get-orgs' }
            });
            if (response.data.success) {
                this.orgs = response.data.data;
            }
        },
        
        async deleteProject(projectId) {
            const response = await axiosInstance.delete('/', {
                headers: { action: 'delete-project', projectid: projectId }
            });
            if (response.data.success) {
                // Update local state
                this.projects = this.projects.filter(p => p.id !== projectId);
                if (this.selectedProject?.id === projectId) {
                    this.selectedProject = null;
                }
            }
            return response.data.success;
        },
    },
});
```

### Dialog Management Pattern

**Pattern**: Use store to control dialog visibility with computed v-model.

**Component** (`AddOrgDialog.vue`):
```vue
<script setup>
import { computed } from 'vue';
import { useOrgStore } from '@/stores/orgStore';

const orgStore = useOrgStore();

// Two-way binding to store state
const visible = computed({
    get: () => orgStore.showAddOrgDialog,
    set: (val) => {
        if (!val) orgStore.showAddOrgDialog = false;
    }
});

function handleSubmit() {
    // Submit logic
    orgStore.showAddOrgDialog = false;
}
</script>

<template>
    <Dialog v-model:visible="visible" header="Add Org" :modal="true">
        <!-- form fields -->
        <template #footer>
            <Button label="Cancel" @click="visible = false" />
            <Button label="Submit" @click="handleSubmit" />
        </template>
    </Dialog>
</template>
```

**Trigger from parent**:
```vue
<script setup>
import { useOrgStore } from '@/stores/orgStore';
const orgStore = useOrgStore();

function openDialog() {
    orgStore.showAddOrgDialog = true;
}
</script>

<template>
    <Button label="Add Org" @click="openDialog" />
    <AddOrgDialog />
</template>
```

### Axios Instance Configuration

**Custom Axios instance** (`src/api/axiosInstance.js`) with:
- Base URL from environment variable
- Request/response interceptors
- Request ID correlation
- Credential support
- Comprehensive logging

```javascript
import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,  // Set in .env
    headers: {
        'Content-Type': 'application/json; charset=utf-8',
    },
    validateStatus: status => status < 500,  // Don't throw on 4xx
    withCredentials: true,  // Send cookies
});

function generateRequestId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID().slice(0, 8);
    }
    return Math.random().toString(36).slice(2, 10);
}

// Request interceptor: attach X-Request-ID
axiosInstance.interceptors.request.use(
    (config) => {
        const requestId = generateRequestId();
        config.headers['X-Request-ID'] = requestId;
        console.log(`[${requestId}] API Request: ${config.method?.toUpperCase()} ${config.url}`, {
            action: config.headers?.action,
        });
        return config;
    },
    (error) => {
        console.error('Request Error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor: log response
axiosInstance.interceptors.response.use(
    (response) => {
        const requestId = response.config.headers?.['X-Request-ID'];
        console.log(`[${requestId}] API Response:`, {
            status: response.status,
            success: response.data?.success,
        });
        return response;
    },
    (error) => {
        const requestId = error.config?.headers?.['X-Request-ID'];
        console.error(`[${requestId}] API Error:`, {
            status: error.response?.status,
            message: error.message,
        });
        return Promise.reject(error);
    }
);

export default axiosInstance;
```

**Usage**:
```javascript
import axiosInstance from '@/api/axiosInstance';

const response = await axiosInstance.get('/', {
    headers: { action: 'get-projects' }
});

if (response.data.success) {
    console.log(response.data.data);
}
```

### Router Navigation Guards

**Router** (`src/router/index.js`) includes global navigation guard for authentication.

```javascript
import { createRouter, createWebHistory } from 'vue-router';
import { isLoggedIn } from '@/composables/auth/useAuth';
import AppLayout from '@/layout/AppLayout.vue';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: AppLayout,
            redirect: '/dashboard',
            children: [
                {
                    path: '/dashboard',
                    name: 'dashboard',
                    component: () => import('@/views/Dashboard.vue')
                },
                {
                    path: '/migrate/:projectId?',
                    name: 'migrate',
                    component: () => import('@/views/MigrationWorkspace.vue')
                },
            ]
        },
        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/pages/auth/Login.vue')
        },
        {
            path: '/auth/register',
            name: 'register',
            component: () => import('@/views/pages/auth/Register.vue')
        },
    ]
});

// Global navigation guard
router.beforeEach(async (to, from, next) => {
    // Allow auth routes
    if (to.path.startsWith('/auth/')) {
        next();
        return;
    }
    
    // Check authentication for protected routes
    const publicPages = ['/auth/login', '/auth/register'];
    const authRequired = !publicPages.includes(to.path);
    const loggedIn = await isLoggedIn();
    
    console.log(`Navigating to: ${to.path}, Auth: ${authRequired}, Logged in: ${loggedIn}`);
    
    if (authRequired && !loggedIn) {
        next('/auth/login');
    } else {
        next();
    }
});

export default router;
```

---

## 🔌 API Design & Routing

### Action-Based Routing (Non-REST)

This project uses **action-header-based routing** instead of traditional REST endpoints.

**Why?**
- Simplified endpoint structure (single endpoint per resource)
- Easy to add new actions without new routes
- Consistent URL patterns
- Centralized action handling

### Backend Routing Pattern

**Route Handler** (`SERVER/src/routes/api.js`):
```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const projectRepo = require('../repositories/projectRepository');
const sendResponse = require('../utils/sendResponse');
const logger = require('../lib/logger');
const log = logger.create('api');

// GET requests
router.get('/', authMiddleware, async (req, res) => {
    const action = req.headers.action?.toLowerCase();

    if (action === 'get-projects') {
        try {
            const projects = await projectRepo.findByUserId(req.user.id);
            sendResponse(res, 200, true, 'Projects retrieved successfully', projects);
        } catch (error) {
            log.error('Failed to retrieve projects', error, { userId: req.user.id });
            sendResponse(res, 500, false, 'Failed to retrieve projects');
        }
    }
    
    else if (action === 'get-orgs') {
        try {
            const orgs = await orgRepo.findByUserId(req.user.id);
            // Mask sensitive fields
            orgs.forEach(org => {
                org.username = '*'.repeat(10);
                org.password = '*'.repeat(10);
                org.securityToken = '*'.repeat(10);
                org.clientId = '*'.repeat(10);
                org.clientSecret = '*'.repeat(10);
            });
            sendResponse(res, 200, true, 'Orgs retrieved successfully', orgs);
        } catch (error) {
            log.error('Failed to retrieve orgs', error, { userId: req.user.id });
            sendResponse(res, 500, false, 'Failed to retrieve orgs');
        }
    }
    
    else if (action === 'get-objects') {
        const orgId = req.headers.orgid;
        if (!orgId) {
            return sendResponse(res, 400, false, 'Org ID is required');
        }
        try {
            const includeFields = req.query.includeFields === 'true';
            const objects = await metadataRepo.findObjectsByOrgId(orgId, { includeFields });
            sendResponse(res, 200, true, 'Objects retrieved successfully', objects);
        } catch (error) {
            log.error('Failed to retrieve objects', error, { orgId });
            sendResponse(res, 500, false, 'Failed to retrieve objects');
        }
    }
    
    else {
        sendResponse(res, 400, false, 'Unknown GET action');
    }
});

// POST requests
router.post('/', authMiddleware, async (req, res) => {
    const action = req.headers.action?.toLowerCase();

    if (action === 'create-project') {
        const { name, description } = req.body;
        if (!name) {
            return sendResponse(res, 400, false, 'Project name is required');
        }
        try {
            const project = await projectRepo.create({
                name,
                description,
                userId: req.user.id
            });
            sendResponse(res, 201, true, 'Project created successfully', project);
        } catch (error) {
            log.error('Failed to create project', error, { userId: req.user.id });
            sendResponse(res, 500, false, 'Failed to create project');
        }
    }
    
    else if (action === 'analyze-org') {
        const { orgId, options } = req.body;
        if (!orgId) {
            return sendResponse(res, 400, false, 'Org ID is required');
        }
        try {
            const result = await metadataService.analyzeAndSaveOrg(orgId, options);
            sendResponse(res, 200, true, 'Org analysis complete', result);
        } catch (error) {
            log.error('Failed to analyze org', error, { orgId });
            sendResponse(res, 500, false, 'Failed to analyze org');
        }
    }
    
    else {
        sendResponse(res, 400, false, 'Unknown POST action');
    }
});

// PUT requests
router.put('/', authMiddleware, async (req, res) => {
    const action = req.headers.action?.toLowerCase();

    if (action === 'update-project') {
        const projectId = req.headers.projectid;
        const { name, description } = req.body;
        if (!projectId) {
            return sendResponse(res, 400, false, 'Project ID is required');
        }
        try {
            const updated = await projectRepo.update(projectId, { name, description });
            sendResponse(res, 200, true, 'Project updated successfully', updated);
        } catch (error) {
            log.error('Failed to update project', error, { projectId });
            sendResponse(res, 500, false, 'Failed to update project');
        }
    }
    
    else {
        sendResponse(res, 400, false, 'Unknown PUT action');
    }
});

// DELETE requests
router.delete('/', authMiddleware, async (req, res) => {
    const action = req.headers.action?.toLowerCase();

    if (action === 'delete-project') {
        const projectId = req.headers.projectid;
        if (!projectId) {
            return sendResponse(res, 400, false, 'Project ID is required');
        }
        try {
            await projectRepo.delete(projectId);
            sendResponse(res, 200, true, 'Project deleted successfully');
        } catch (error) {
            log.error('Failed to delete project', error, { projectId });
            sendResponse(res, 500, false, 'Failed to delete project');
        }
    }
    
    else {
        sendResponse(res, 400, false, 'Unknown DELETE action');
    }
});

module.exports = router;
```

### Frontend API Call Pattern

**Using the custom axios instance**:
```javascript
import axiosInstance from '@/api/axiosInstance';

// GET request
const getProjects = async () => {
    const response = await axiosInstance.get('/', {
        headers: { action: 'get-projects' }
    });
    return response.data;
};

// POST request
const createProject = async (name, description) => {
    const response = await axiosInstance.post('/', 
        { name, description },
        { headers: { action: 'create-project' } }
    );
    return response.data;
};

// PUT request with ID in header
const updateProject = async (projectId, name, description) => {
    const response = await axiosInstance.put('/',
        { name, description },
        { headers: { action: 'update-project', projectid: projectId } }
    );
    return response.data;
};

// DELETE request with ID in header
const deleteProject = async (projectId) => {
    const response = await axiosInstance.delete('/', {
        headers: { action: 'delete-project', projectid: projectId }
    });
    return response.data;
};

// GET with query parameters and org ID
const getObjects = async (orgId, includeFields = false) => {
    const response = await axiosInstance.get('/', {
        headers: { action: 'get-objects', orgid: orgId },
        params: { includeFields }
    });
    return response.data;
};
```

### Action Naming Conventions

**Pattern**: `<verb>-<resource>` (kebab-case)

**Common actions**:
- `get-projects` - Retrieve all projects for user
- `get-orgs` - Retrieve all orgs for user
- `get-objects` - Retrieve objects for an org
- `get-fields` - Retrieve fields for an object
- `create-project` - Create new project
- `update-project` - Update existing project
- `delete-project` - Delete project
- `analyze-org` - Trigger Salesforce metadata analysis

**Parameters**:
- **Resource IDs**: Pass in request headers (e.g., `orgid`, `projectid`, `objectid`)
- **Data payloads**: Pass in request body
- **Query/filter options**: Pass as query parameters (`req.query`)

---

## 🔐 Authentication & Security

### JWT Authentication Flow

#### 1. Registration
```javascript
// POST /auth/register
// Body: { email, password, firstname, lastname, username }
// Response: Sets auth_token HttpOnly cookie
```

**Backend** (`SERVER/src/routes/auth.js`):
```javascript
router.post('/register', async (req, res) => {
    const { email, password, firstname, lastname, username } = req.body;
    
    // Validate inputs
    if (!email || !password || !firstname || !lastname || !username) {
        return sendResponse(res, 400, false, 'All fields are required');
    }
    
    const validateEmail = validator.validateEmail(email);
    const validateUsername = validator.validateUsername(username);
    const validatePassword = validator.validatePassword(password);
    
    if (!validateEmail || !validateUsername || !validatePassword) {
        return sendResponse(res, 400, false, 'Validation failed');
    }
    
    // Check for existing user
    const existingUser = await userRepo.findByEmail(email);
    if (existingUser) {
        return sendResponse(res, 409, false, 'Email already registered');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Create user
    const newUser = await userRepo.create({
        email,
        password: hashedPassword,
        firstname,
        lastname,
        username,
        role: 'user',
        isActive: true,
        emailVerified: false,
    });
    
    // Generate JWT
    const token = jwt.sign(
        {
            id: newUser.id,
            email: newUser.email,
            username: newUser.username,
            role: newUser.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRATION || '12h' }
    );
    
    // Set HttpOnly cookie
    res.setHeader(
        'Set-Cookie',
        `auth_token=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=43200; ${process.env.NODE_ENV === 'production' ? 'Secure; SameSite=Strict;' : 'SameSite=Lax'}`
    );
    
    sendResponse(res, 201, true, 'User registered successfully', {
        email: newUser.email,
        username: newUser.username,
    });
});
```

#### 2. Login
```javascript
// POST /auth/login
// Body: { userIdentifier, password }
// Response: Sets auth_token HttpOnly cookie
```

**Backend**:
```javascript
router.post('/login', async (req, res) => {
    const { userIdentifier, password } = req.body;
    
    if (!userIdentifier || !password) {
        return sendResponse(res, 400, false, 'Credentials required');
    }
    
    // Find user by email or username
    const userByEmail = await userRepo.findByEmail(userIdentifier);
    const userByUsername = await userRepo.findByUsername(userIdentifier);
    
    const user = userByEmail || userByUsername;
    
    if (!user) {
        return sendResponse(res, 404, false, 'User not found');
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
        return sendResponse(res, 401, false, 'Invalid credentials');
    }
    
    // Update last login (async, don't await)
    userRepo.updateLastLogin(user.id);
    
    // Generate JWT
    const token = jwt.sign(
        {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRATION || '12h' }
    );
    
    // Set HttpOnly cookie
    res.setHeader(
        'Set-Cookie',
        `auth_token=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=43200; ${process.env.NODE_ENV === 'production' ? 'Secure; SameSite=Strict;' : 'SameSite=Lax'}`
    );
    
    sendResponse(res, 200, true, 'Login successful', {
        email: user.email,
        username: user.username,
    });
});
```

#### 3. Token Validation (Auth Middleware)

**Middleware** (`SERVER/src/middleware/authMiddleware.js`):
```javascript
const jwt = require('jsonwebtoken');
const userRepo = require('../repositories/userRepository');
const sendResponse = require('../utils/sendResponse');
const parseCookies = require('../utils/parseCookies');
const logger = require('../lib/logger');
const log = logger.create('authMiddleware');

async function authMiddleware(req, res, next) {
    // Check for action header (required for all API calls)
    if (!req.headers.action) {
        return sendResponse(res, 400, false, 'Missing action header');
    }
    
    // Parse cookies
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.auth_token;
    
    if (!token) {
        log.warn('No token provided');
        return sendResponse(res, 401, false, 'Unauthorized');
    }
    
    try {
        // Verify JWT
        const userData = jwt.verify(token, process.env.JWT_SECRET);
        
        // Fetch full user from database
        const fullUser = await userRepo.findById(userData.id);
        
        if (!fullUser) {
            log.warn('User not found during token validation', { userId: userData.id });
            return sendResponse(res, 404, false, 'User not found');
        }
        
        // Attach user to request object
        req.user = fullUser;
        
        return next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            log.warn('Token expired');
            return sendResponse(res, 401, false, 'Token expired');
        }
        log.error('Token verification failed', error);
        return sendResponse(res, 403, false, 'Invalid token');
    }
}

module.exports = authMiddleware;
```

#### 4. Frontend Authentication Flow

**Login Composable** (`src/composables/auth/useAuth.js`):
```javascript
import axiosInstance from '@/api/axiosInstance';
import { useUserStore } from '@/stores/userStore';
import { useOrgStore } from '@/stores/orgStore';

export function useAuth() {
    const userStore = useUserStore();
    const orgStore = useOrgStore();

    const login = async (email, password) => {
        try {
            // Step 1: Login
            const loginResponse = await axiosInstance.post('/auth/login',
                { userIdentifier: email, password },
                { headers: { action: 'login' } }
            );

            if (loginResponse.status === 200) {
                // Step 2: Verify token and get user info
                const whoamiResponse = await axiosInstance.get('/auth/whoami',
                    { headers: { action: 'whoami' }, withCredentials: true }
                );
                
                if (whoamiResponse.status === 200) {
                    // Update stores
                    userStore.setIsAuthenticated(true);
                    userStore.setEmail(whoamiResponse.data.data.email);
                    userStore.setUsername(whoamiResponse.data.data.username);
                    orgStore.loadProjects();  // Load user data
                }
                
                return whoamiResponse;
            }

            return loginResponse;
        } catch (error) {
            console.error('Login failed:', error.message);
            return null;
        }
    };

    return { login };
}

// Check if user is logged in (for router guards)
export async function isLoggedIn() {
    const userStore = useUserStore();
    try {
        const whoamiResponse = await axiosInstance.get('/auth/whoami',
            { headers: { action: 'whoami' }, withCredentials: true }
        );
        
        if (whoamiResponse.status === 200) {
            userStore.isAuthenticated = true;
            userStore.email = whoamiResponse.data.data.email;
            userStore.username = whoamiResponse.data.data.username;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Auth check failed:', error);
        return false;
    }
}
```

### Password Security

- **Hashing**: bcrypt with 10 salt rounds
- **Validation**: Minimum length, complexity requirements (see `SERVER/src/routes/validator.js`)
- **Storage**: Never store plain-text passwords
- **Transmission**: Always over HTTPS in production

### Cookie Security

**HttpOnly**: Prevents JavaScript access (XSS protection)
**Secure**: HTTPS-only in production
**SameSite**: CSRF protection
**Max-Age**: 12 hours (configurable via JWT_EXPIRATION)

### Sensitive Data Masking

**Always mask credentials in API responses**:
```javascript
// In api.js - get-orgs action
const orgs = await orgRepo.findByUserId(req.user.id);
orgs.forEach(org => {
    org.username = '*'.repeat(10);
    org.password = '*'.repeat(10);
    org.securityToken = '*'.repeat(10);
    org.clientId = '*'.repeat(10);
    org.clientSecret = '*'.repeat(10);
});
sendResponse(res, 200, true, 'Orgs retrieved', orgs);
```

---

## 💾 Database & Models

### Database Configuration

**Environment-based config** (`SERVER/config/config.js`):
```javascript
const path = require('path');
const fs = require('fs');

const env = process.env.NODE_ENV || 'development';
const envFile = path.resolve(__dirname, `../.env.${env}`);

if (fs.existsSync(envFile)) {
    require('dotenv').config({ path: envFile });
}

const development = {
    username: process.env.DB_USER || 'sf_migrator',
    password: process.env.DB_PASSWORD || '1199',
    database: process.env.DB_NAME || 'sf_migrator_dev',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    logging: false,
    schema: process.env.DB_SCHEMA || 'public'
};

module.exports = {
    development: { ...development },
    test: { ...development, database: 'sf_migrator_test' },
    production: { ...development, logging: true },
};
```

### Model Definition Pattern

**All models use**:
- UUID primary keys
- Timestamps (createdAt, updatedAt)
- Associations defined in `Model.associate(models)`
- Custom validators where needed

**Example** (`SERVER/models/Project.js`):
```javascript
'use strict';

module.exports = (sequelize, DataTypes) => {
    const Project = sequelize.define('Project', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id',
            },
        },
    });

    Project.associate = function(models) {
        Project.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user'
        });
        Project.hasMany(models.SfOrg, {
            foreignKey: 'projectId',
            as: 'orgs'
        });
    };

    return Project;
};
```

### Core Relationships

**User → Project → SfOrg** hierarchy:
```
User (1) ──┬──> (many) Project
           │
           └──> (many) SfOrg (via Project)

Project (1) ──> (many) SfOrg

SfOrg (1) ──┬──> (many) SfObjectMetadata
            │
            └──> (many) Analysis (future)

SfObjectMetadata (1) ──> (many) SfFieldMetadata

ObjectMapping (1) ──> (many) FieldMapping
```

**Note**: Specific model schemas may change. Always use repository abstractions.

### Sequelize CLI Commands

**From `SERVER/` directory**:

```powershell
# Migrations
npm run migrate:dev              # Run pending migrations
npm run migrate:status:dev       # Check migration status
npx sequelize-cli migration:generate --name migration-name   # Create new migration

# Seeds
npm run seed:dev                 # Run all seeders
npm run seed:undo:dev            # Undo all seeders
npx sequelize-cli seed:generate --name seed-name             # Create new seeder

# Fresh setup
npm run fresh:dev                # Undo all, migrate, seed
```

### Migration Pattern

**Create migration**:
```powershell
cd SERVER
npx sequelize-cli migration:generate --name create-users-table
```

**Migration file** (`SERVER/migrations/YYYYMMDDHHMMSS-create-users-table.js`):
```javascript
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('Users', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false,
            },
            email: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            password: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            username: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            firstname: {
                type: Sequelize.STRING,
            },
            lastname: {
                type: Sequelize.STRING,
            },
            role: {
                type: Sequelize.STRING,
                defaultValue: 'user',
            },
            isActive: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
        });

        await queryInterface.addIndex('Users', ['email'], { unique: true });
        await queryInterface.addIndex('Users', ['username'], { unique: true });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('Users');
    }
};
```

### Seeder Pattern

**Create seeder**:
```powershell
npx sequelize-cli seed:generate --name demo-users
```

**Seeder file** (`SERVER/seeders/YYYYMMDDHHMMSS-demo-users.js`):
```javascript
'use strict';
const bcrypt = require('bcrypt');

module.exports = {
    async up(queryInterface, Sequelize) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        
        await queryInterface.bulkInsert('Users', [{
            id: Sequelize.fn('uuid_generate_v4'),
            email: 'demo@example.com',
            username: 'demouser',
            password: hashedPassword,
            firstname: 'Demo',
            lastname: 'User',
            role: 'user',
            isActive: true,
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        }], {});
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('Users', { email: 'demo@example.com' }, {});
    }
};
```

---

## 🔗 Salesforce Integration

### JSforce Connection Management

**Service** (`SERVER/src/services/salesforceService.js`) handles all Salesforce interactions.

**Connection Pooling**:
```javascript
const jsforce = require('jsforce');
const connectionPool = new Map();

async function createConnection(sfOrg) {
    const conn = new jsforce.Connection({
        oauth2: {
            loginUrl: sfOrg.loginURL,
            clientId: sfOrg.clientId,
            clientSecret: sfOrg.clientSecret,
            redirectUri: `${sfOrg.loginURL}/services/oauth2/success`,
        },
        version: '65.0',
    });

    await conn.login(sfOrg.username, sfOrg.password + (sfOrg.securityToken || ''));
    
    return conn;
}

async function connectToOrg(sfOrgId) {
    // Check pool
    if (connectionPool.has(sfOrgId)) {
        const conn = connectionPool.get(sfOrgId);
        try {
            await conn.identity();  // Verify connection is alive
            return conn;
        } catch (error) {
            connectionPool.delete(sfOrgId);
        }
    }
    
    // Create new connection
    const org = await orgRepo.findById(sfOrgId);
    const conn = await createConnection(org);
    connectionPool.set(sfOrgId, conn);
    
    return conn;
}
```

### Metadata Retrieval Pattern

**describeGlobal** (list all objects):
```javascript
async function describeGlobal(sfOrgId) {
    const conn = await connectToOrg(sfOrgId);
    const result = await conn.describeGlobal();
    return result.sobjects.map(obj => ({
        objectName: obj.name,
        label: obj.label,
        isCustom: obj.custom,
        isQueryable: obj.queryable,
    }));
}
```

**describeObject** (get object details with fields):
```javascript
async function describeObject(sfOrgId, objectName) {
    const conn = await connectToOrg(sfOrgId);
    const result = await conn.sobject(objectName).describe();
    
    return {
        objectName: result.name,
        label: result.label,
        isCustom: result.custom,
        fields: result.fields.map(f => ({
            fieldName: f.name,
            label: f.label,
            dataType: f.type,
            length: f.length,
            isRequired: !f.nillable,
            isUnique: f.unique,
            isCustom: f.custom,
        })),
    };
}
```

**getRecordCount**:
```javascript
async function getRecordCount(sfOrgId, objectName) {
    try {
        const conn = await connectToOrg(sfOrgId);
        const result = await conn.query(`SELECT COUNT() FROM ${objectName}`);
        return result.totalSize;
    } catch (error) {
        log.warn(`Failed to get record count for ${objectName}`, error);
        return 0;
    }
}
```

### Object Filtering

**Hardcoded exclusions** (`SERVER/src/services/config/objectsToExclude.js`):
```javascript
module.exports = {
    hardcodedList: [
        'ActivityHistory',
        'AttachedContentDocument',
        'CombinedAttachment',
        // ... many more standard Salesforce objects
    ],
    patternList: [
        /^.*History$/,
        /^.*Share$/,
        /^.*Feed$/,
        /^.*ChangeEvent$/,
        // ... regex patterns for event objects, etc.
    ],
};
```

**Applied in metadataService**:
```javascript
async function analyzeAndSaveOrg(sfOrgId, options = {}) {
    const objects = await salesforceService.describeGlobal(sfOrgId);
    
    // User filters
    let filtered = options.objectsToAnalyze
        ? objects.filter(obj => options.objectsToAnalyze.includes(obj.objectName))
        : objects;
    
    // Hardcoded filters
    filtered = filtered.filter(obj => 
        !standardObjectFilters.hardcodedList.includes(obj.objectName)
    );
    
    filtered = filtered.filter(obj => 
        !standardObjectFilters.patternList.some(pattern => pattern.test(obj.objectName))
    );
    
    // Process filtered objects
    for (const obj of filtered) {
        // ... fetch details and save
    }
}
```

### Tooling API & REST API Queries

**Tooling API** (`SERVER/src/services/queries/toolingAPIqueries.js`):
- Used for fetching metadata about configured features, picklists, etc.
- Wrapper functions around jsforce's tooling API

**REST API** (`SERVER/src/services/queries/restAPIqueries.js`):
- Standard SOQL queries
- Data retrieval

**Reference**: Always consult `SERVER/docs/JSFORCE_REFERENCE.md` for patterns and best practices.

---

## 📝 Logging & Debugging

### Structured Logging with AsyncLocalStorage

**Logger** (`SERVER/src/lib/logger.js`) provides:
- Caller identification (module name)
- Request tracing (requestId + action from AsyncLocalStorage)
- Full error serialization
- Console output + file output

**Usage**:
```javascript
const logger = require('../lib/logger');
const log = logger.create('myModule');

// Info log
log.info('Something happened', { key: 'value' });

// Error log (with Error object)
try {
    // ... some operation
} catch (error) {
    log.error('Operation failed', error, { orgId: '...' });
}

// Warning log
log.warn('Potential issue detected', { detail: 'xyz' });

// Debug log
log.debug('Debug information', { data: { ... } });
```

**Log Format**:
```
$[2026-02-17T12:34:56.789Z][INFO][myModule][req:a1b2c3d4] [action:get-projects] Message
{ key: 'value' }
```

**Request Context**:
The logger automatically includes:
- `requestId`: Unique ID for each request (from `X-Request-ID` header)
- `action`: The action header value
- `orgId`: If present in request body

**Error Serialization**:
Captures full error details including:
- name, message, stack
- All own properties (code, errorCode, etc.)
- Prototype properties (jsforce errors)
- Nested error objects

### Request Tracing

**Middleware** (`SERVER/src/middleware/requestTracer.js`) generates request IDs:
```javascript
const crypto = require('crypto');
const { asyncLocalStorage } = require('../lib/logger');

function requestTracer(req, res, next) {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID().slice(0, 8);
    const action = req.headers.action || '-';
    const orgId = req.body.orgId || '-';

    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    asyncLocalStorage.run({ requestId, action, orgId }, () => {
        next();
    });
}
```

**End-to-end tracing**:
1. Frontend generates `X-Request-ID` and sends with request
2. Backend uses received ID or generates new one
3. ID is stored in AsyncLocalStorage
4. All logs within request context automatically include ID
5. ID is returned in response header

**Frontend correlation**:
```javascript
// axiosInstance.js interceptors log request ID
console.log(`[${requestId}] API Request: GET /`);
console.log(`[${requestId}] API Response: 200 OK`);
```

### Debugging Tips

**Check logs in console**:
- Backend logs include request ID, action, module name
- Frontend logs include request ID, action, URL

**Common debugging scenarios**:

1. **Request failing**: Check request ID in browser console, search backend logs for same ID
2. **Database query issues**: Repository logs include operation details
3. **Salesforce API errors**: salesforceService logs full jsforce error objects
4. **Authentication issues**: authMiddleware logs token validation failures

---

## ⚙️ Configuration & Environments

### Environment Variables

**Backend** uses environment-specific `.env` files in `SERVER/` directory:

**`SERVER/.env.development`**:
```env
NODE_ENV=development
PORT=3000
JWT_SECRET=your-secret-key-dev
JWT_EXPIRATION=12h
FRONTEND_URL=http://localhost:5173
DB_USER=sf_migrator
DB_PASSWORD=1199
DB_NAME=sf_migrator_dev
DB_HOST=127.0.0.1
DB_SCHEMA=public
DB_LOGGING=false
```

**Loaded in**:
- `SERVER/config/config.js` (database config)
- `SERVER/src/server.js` (server startup)

**Frontend** uses Vite environment variables:

**`.env` or `.env.local`** (root directory):
```env
VITE_API_URL=http://localhost:3000
```

**Access in Vue**:
```javascript
const apiUrl = import.meta.env.VITE_API_URL;
```

### Configuration Management

**Database config** (`SERVER/config/config.js`):
- Auto-loads environment-specific `.env` file
- Exports config object for Sequelize CLI
- Supports development, test, production environments

**Vite config** (`vite.config.mjs`):
- PrimeVue auto-import
- Path alias: `@` → `src/`
- Asset includes for images

**TailwindCSS config** (`tailwind.config.js`):
- Custom breakpoints
- PrimeUI plugin integration
- Dark mode selector

**PostCSS config** (`postcss.config.js`):
- TailwindCSS integration

---

## 🎨 Code Style & Conventions

### General Rules

**Backend (Node.js/Express)**:
- Use **CommonJS** (`require`, `module.exports`)
- Use `async/await` (no callbacks)
- Use `const` and `let` (never `var`)
- Use arrow functions for callbacks

**Frontend (Vue 3)**:
- Use **ES6 modules** (`import`, `export`)
- Use `<script setup>` Composition API
- Use `async/await`
- Use `const` and `let`

### Naming Conventions

**Variables & Functions**: `camelCase`
```javascript
const userName = 'John';
function getUserById(id) { }
```

**Constants**: `UPPER_SNAKE_CASE`
```javascript
const SALT_ROUNDS = 10;
const MAX_CONNECTIONS = 100;
```

**Classes & Components**: `PascalCase`
```javascript
class UserService { }
// Component: AddOrgDialog.vue
```

**Files**:
- Services: `serviceNameService.js` (e.g., `salesforceService.js`)
- Repositories: `resourceRepository.js` (e.g., `userRepository.js`)
- Components: `PascalCase.vue` (e.g., `AddProjectDialog.vue`)
- Utils: `camelCase.js` (e.g., `sendResponse.js`)

### File Organization

**Imports order**:
```javascript
// 1. Node.js built-ins
const path = require('path');
const fs = require('fs');

// 2. External dependencies
const express = require('express');
const bcrypt = require('bcrypt');

// 3. Internal modules (services, repositories)
const userRepo = require('../repositories/userRepository');
const logger = require('../lib/logger');

// 4. Utils
const sendResponse = require('../utils/sendResponse');
```

**Vue component order**:
```vue
<script setup>
// 1. Imports
import { ref, computed, onMounted } from 'vue';
import { useOrgStore } from '@/stores/orgStore';

// 2. Stores
const orgStore = useOrgStore();

// 3. Reactive state
const projects = ref([]);
const loading = ref(false);

// 4. Computed properties
const filteredProjects = computed(() => { });

// 5. Functions
async function loadProjects() { }
function handleClick() { }

// 6. Lifecycle hooks
onMounted(() => { });
</script>

<template>
  <!-- template -->
</template>

<style scoped>
/* styles */
</style>
```

### Error Handling

**Always use try/catch with async/await**:
```javascript
async function doSomething() {
    try {
        const result = await someAsyncOperation();
        return result;
    } catch (error) {
        log.error('Operation failed', error, { context: '...' });
        throw error;  // or handle gracefully
    }
}
```

**Don't swallow errors silently**:
```javascript
// ❌ Bad
try {
    await operation();
} catch (error) {
    // nothing
}

// ✅ Good
try {
    await operation();
} catch (error) {
    log.error('Operation failed', error);
    // Handle or rethrow
}
```

### Comments

**Use comments for**:
- Complex logic explanation
- TODOs
- Public API documentation

**Don't use comments for**:
- Obvious code (`// increment i`)
- Commented-out code (delete it, use version control)

**Comment style**:
```javascript
/**
 * Repository function description
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of projects
 */
async function findByUserId(userId) {
    return Project.findAll({ where: { userId } });
}

// Single-line comment for logic explanation
```

### Code Formatting

**Use Prettier** (configured in `package.json`):
- 4 spaces indentation
- Single quotes
- Semicolons
- Trailing commas

---

## 🔨 Common Tasks & Operations

### Adding a New API Endpoint

**Example**: Add "get project by ID" endpoint

**1. Create repository function** (`projectRepository.js`):
```javascript
async function findById(id) {
    return Project.findByPk(id);
}

module.exports = {
    // ... existing exports
    findById,
};
```

**2. Add route handler** (`api.js`):
```javascript
router.get('/', authMiddleware, async (req, res) => {
    const action = req.headers.action?.toLowerCase();

    // ... existing actions

    else if (action === 'get-project') {
        const projectId = req.headers.projectid;
        if (!projectId) {
            return sendResponse(res, 400, false, 'Project ID required');
        }
        try {
            const project = await projectRepo.findById(projectId);
            if (!project) {
                return sendResponse(res, 404, false, 'Project not found');
            }
            sendResponse(res, 200, true, 'Project retrieved', project);
        } catch (error) {
            log.error('Failed to get project', error, { projectId });
            sendResponse(res, 500, false, 'Failed to get project');
        }
    }
});
```

**3. Add frontend API call** (in store or composable):
```javascript
async function getProject(projectId) {
    const response = await axiosInstance.get('/', {
        headers: { action: 'get-project', projectid: projectId }
    });
    return response.data;
}
```

### Adding a New Database Model

**1. Generate migration**:
```powershell
cd SERVER
npx sequelize-cli migration:generate --name create-new-model
```

**2. Edit migration file**:
```javascript
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('NewModels', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            // ... other fields
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('NewModels');
    }
};
```

**3. Create model file** (`SERVER/models/NewModel.js`):
```javascript
module.exports = (sequelize, DataTypes) => {
    const NewModel = sequelize.define('NewModel', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        // ... other fields
    });

    NewModel.associate = function(models) {
        // Define associations
    };

    return NewModel;
};
```

**4. Run migration**:
```powershell
npm run migrate:dev
```

**5. Create repository** (`SERVER/src/repositories/newModelRepository.js`):
```javascript
const { NewModel } = require('../../models');
const logger = require('../lib/logger');
const log = logger.create('newModelRepository');

async function findAll() {
    return NewModel.findAll();
}

async function findById(id) {
    return NewModel.findByPk(id);
}

async function create(data) {
    const instance = await NewModel.create(data);
    log.info('NewModel created', { id: instance.id });
    return instance;
}

module.exports = {
    findAll,
    findById,
    create,
};
```

### Adding a New Vue Component

**1. Create component file** (`src/components/MyComponent.vue`):
```vue
<script setup>
import { ref } from 'vue';

// Props
const props = defineProps({
    title: {
        type: String,
        required: true
    }
});

// Emits
const emit = defineEmits(['save', 'cancel']);

// State
const data = ref(null);

// Functions
function handleSave() {
    emit('save', data.value);
}
</script>

<template>
    <div class="my-component">
        <h2>{{ title }}</h2>
        <Button label="Save" @click="handleSave" />
    </div>
</template>

<style scoped>
.my-component {
    padding: 1rem;
}
</style>
```

**2. Use component** (in parent component):
```vue
<script setup>
import MyComponent from '@/components/MyComponent.vue';

function handleSave(data) {
    console.log('Saved:', data);
}
</script>

<template>
    <MyComponent 
        title="My Title" 
        @save="handleSave"
    />
</template>
```

### Adding a New Pinia Store

**1. Create store file** (`src/stores/newStore.js`):
```javascript
import { defineStore } from 'pinia';
import axiosInstance from '@/api/axiosInstance';

export const useNewStore = defineStore('newStore', {
    
    persist: true,
    
    state: () => ({
        items: [],
        selectedItem: null,
    }),
    
    getters: {
        itemCount: (state) => state.items.length,
    },
    
    actions: {
        async loadItems() {
            const response = await axiosInstance.get('/', {
                headers: { action: 'get-items' }
            });
            if (response.data.success) {
                this.items = response.data.data;
            }
        },
        
        setSelectedItem(item) {
            this.selectedItem = item;
        },
    },
});
```

**2. Use store in component**:
```vue
<script setup>
import { useNewStore } from '@/stores/newStore';
import { onMounted } from 'vue';

const newStore = useNewStore();

onMounted(() => {
    newStore.loadItems();
});
</script>

<template>
    <div>
        <p>Item count: {{ newStore.itemCount }}</p>
        <ul>
            <li v-for="item in newStore.items" :key="item.id">
                {{ item.name }}
            </li>
        </ul>
    </div>
</template>
```

---

## 🐛 Troubleshooting & Gotchas

### Common Issues

#### 1. "400 Bad Request" - Missing Action Header
**Problem**: Forgot to include `action` header in API request

**Solution**:
```javascript
// ❌ Wrong
const response = await axiosInstance.get('/');

// ✅ Correct
const response = await axiosInstance.get('/', {
    headers: { action: 'get-projects' }
});
```

#### 2. "401 Unauthorized" - Cookie Not Sent
**Problem**: `withCredentials` not set for cookie-based auth

**Solution**:
```javascript
// In axiosInstance.js
const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,  // ✅ Required for cookies
});
```

#### 3. Two Servers Must Run Simultaneously
**Problem**: Only ran frontend, backend not started

**Solution**: Always run both:
```powershell
# Terminal 1 - Backend
cd SERVER
npm run start:dev

# Terminal 2 - Frontend
npm run dev
```

Or use the PowerShell script:
```powershell
powershell.exe .\startDevServers.ps1
```

#### 4. Database Connection Errors
**Problem**: PostgreSQL not running or wrong credentials

**Check**:
```powershell
# Check if PostgreSQL is running
Get-Service postgresql*

# If not running, start it
Start-Service postgresql-x64-{version}
```

**Verify config** in `SERVER/config/config.js` matches your database setup.

#### 5. Migrations Must Run Before Seeds
**Problem**: Ran seeds without running migrations first

**Solution**:
```powershell
cd SERVER
npm run migrate:dev   # Run this FIRST
npm run seed:dev      # Then run this
```

Or use fresh setup:
```powershell
npm run fresh:dev  # Undo all, migrate, seed
```

#### 6. Sequelize Model Not Found
**Problem**: Created model but not loaded by `models/index.js`

**Solution**: Ensure:
- Model file ends with `.js`
- Model file is in `SERVER/models/` directory
- Model exports function that returns Sequelize model
- Restart backend server

#### 7. PrimeVue Component Not Found
**Problem**: Component not auto-imported

**Check**:
- Is it a PrimeVue component? (auto-imported)
- Or a custom component? (needs manual import)

```vue
<!-- ✅ PrimeVue - auto-imported -->
<Button label="Click" />

<!-- ✅ Custom - manual import -->
<script setup>
import MyComponent from '@/components/MyComponent.vue';
</script>
<template>
    <MyComponent />
</template>
```

#### 8. CORS Errors
**Problem**: Frontend can't access backend API

**Solution**: Backend already configured CORS in `server.js`:
```javascript
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    exposedHeaders: ['X-Request-ID'],
}));
```

Ensure `FRONTEND_URL` in `.env` matches your frontend URL.

#### 9. Sensitive Data Exposed in API
**Problem**: Org credentials returned in API response

**Solution**: Always mask sensitive fields (see `get-orgs` action):
```javascript
orgs.forEach(org => {
    org.username = '*'.repeat(10);
    org.password = '*'.repeat(10);
    org.securityToken = '*'.repeat(10);
    org.clientId = '*'.repeat(10);
    org.clientSecret = '*'.repeat(10);
});
```

#### 10. Salesforce Connection Failed
**Problem**: jsforce connection error

**Check**:
1. **Read `SERVER/docs/JSFORCE_REFERENCE.md` first**
2. Verify org credentials (username, password, security token)
3. Verify connected app credentials (clientId, clientSecret)
4. Check loginUrl (production vs sandbox)
5. Ensure password + securityToken concatenation
6. Check if OAuth2 Username-Password flow is enabled (orgs created after Summer '23)

**Correct pattern**:
```javascript
const conn = new jsforce.Connection({
    oauth2: {
        loginUrl: 'https://login.salesforce.com',  // Not instance URL!
        clientId: '<clientId>',
        clientSecret: '<clientSecret>',
        redirectUri: '<loginUrl>/services/oauth2/success',
    },
    version: '65.0',
});

await conn.login(username, password + securityToken);
```

---

## 📚 Additional Resources

### Documentation Files

**Primary References** (always read these first):
- `SERVER/docs/ARCHITECTURE.md` - Complete architecture documentation
- `SERVER/docs/JSFORCE_REFERENCE.md` - Salesforce integration patterns
- `SERVER/docs/STARTUP_GUIDE.md` - Quick start guide
- `SERVER/docs/ENVIRONMENT_SETUP.md` - Environment configuration

**Database Setup**:
- `SERVER/scripts/db/queries.sql` - Complete database setup instructions

**README Files**:
- `README.md` - Project overview and basic setup

---

## 🎯 Summary & Quick Reference

### Project Architecture
```
Frontend (Vue 3 + Vite + PrimeVue)
    ↓ Axios (action-based API)
Backend (Express + Sequelize)
    ↓ Middleware → Routes → Services → Repositories → Models
Database (PostgreSQL)

Salesforce (jsforce)
    ↑ Services Layer
```

### Key Patterns
- **Action-based routing**: All API calls use `action` header
- **Repository pattern**: Only repositories touch Sequelize models
- **Service orchestration**: Services call multiple repositories + external APIs
- **Structured logging**: Request tracing with AsyncLocalStorage
- **JWT auth**: HttpOnly cookies with middleware validation
- **Connection pooling**: jsforce connections cached and reused

### Development Commands
```powershell
# Setup
npm install                      # Frontend deps
cd SERVER && npm install         # Backend deps
npm run migrate:dev              # Run migrations
npm run seed:dev                 # Seed data

# Start servers
cd SERVER && npm run start:dev   # Backend
npm run dev                      # Frontend
# OR
powershell.exe .\startDevServers.ps1

# Database
npm run fresh:dev                # Fresh DB setup
npm run migrate:status:dev       # Check migrations
```

### Common Workflows
- **New endpoint**: Repository → Route handler → Frontend call
- **New model**: Migration → Model file → Repository → Service
- **New component**: Create .vue file → Import in parent
- **New store**: Create store file → Use in components

---

**End of Copilot Instructions**
