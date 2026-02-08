# SF Migrator - AI Agent Instructions

## ⚠️ CRITICAL: Salesforce Service Development

**When working with Salesforce connections or the salesforceService.js file:**

1. **ALWAYS reference `SERVER/docs/JSFORCE_REFERENCE.md` FIRST** - This contains curated jsforce patterns and best practices specific to our application
2. **Do not guess or assume** jsforce API behavior

**Key Rules:**
- Use Username-Password login for long-running operations (has automatic refresh)
- Avoid OAuth Client Credentials flow for metadata operations (no refresh token)
- Always concatenate password + securityToken when logging in
- Use correct loginUrl (https://login.salesforce.com, NOT instance URLs)

## Architecture Overview
This is a Salesforce data migration tool with a **Vue 3 frontend** (`src/`) and **Express backend** (`SERVER/src/`). PostgreSQL database with Sequelize ORM. The tool is under active development - see [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) for planned features (metadata retrieval, field mapping, migration engine).

**Tech Stack:**
- Frontend: Vue 3 + Vite + PrimeVue 4.3.3 + Pinia + TailwindCSS
- Backend: Express + Sequelize + jsforce (Salesforce SDK)
- Database: PostgreSQL with UUID primary keys
- Auth: JWT tokens in HttpOnly cookies

## Critical API Pattern ⚠️
This project uses a **non-REST API design**: all authenticated endpoints use `GET|POST|PUT` to `/` with an `action` header to specify the operation.

**Examples:**
```javascript
// Frontend: Get projects
axiosInstance.get('/', { headers: { action: 'get-projects' } });

// Backend: Handle action
app.get("/", authMiddleware, async (req, res) => {
    if (req.headers.action.toLowerCase() === 'get-projects') {
        // handle get-projects
    }
});
```

**Auth endpoints** use traditional routes: `/auth/login`, `/auth/register`, `/auth/whoami`




## Development Workflow



### Initial Setup
1. Install PostgreSQL, ensure server running
2. Install deps: `cd SERVER && npm install && cd .. && npm install`
3. Configure database in `SERVER/config/config.json`
4. Run migrations: `cd SERVER && npm run migrate`
5. Seed data: `npm run seed` (creates test users/projects/orgs)



### Running the App
- **Backend**: `cd SERVER/src && node server.js` → http://localhost:3000
- **Frontend**: `npm run dev` → http://localhost:5173
- Run **both servers simultaneously** in separate terminals

### Database Commands (from `SERVER/`)
```bash
npm run migrate        # Run all pending migrations
npm run seed          # Seed all data
npm run seed-users    # Seed only users
npm run migrate-seed  # Migrate then seed (fresh setup)
```



## Database Models & Relationships

**Core Models** (in `SERVER/models/`):
- `User` → 1:many Projects (UUID PKs, bcrypt passwords)
- `Project` → belongs to User, 1:many SfOrgs
- `SfOrg` → Salesforce org credentials (OAuth or Username/Password/Token)
  - **Custom validator**: connectionType determines required fields
  - OAuth requires: `clientId`, `clientSecret`
  - Credentials requires: `username`, `password`, `securityToken`

**Associations** defined via `Model.associate()` in each model file:
```javascript
Project.associate = function(models) {
    Project.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
};
```




## Frontend Patterns



### Component Structure
- Use `<script setup>` Composition API (all existing components)
- PrimeVue components **auto-import** via `unplugin-vue-components` (no manual imports needed for PrimeVue)
- Manual imports for: composables, stores, axios

**Dialog Pattern** (see [AddOrgDialog.vue](../src/components/AddOrgDialog.vue)):
```vue
<script setup>
const orgStore = useOrgStore();
const visible = computed({
    get: () => orgStore.showAddOrgDialog,
    set: (val) => { if (!val) orgStore.showAddOrgDialog = false; }
});
</script>
```



### State Management (Pinia)
- **Persistence enabled** via `pinia-plugin-persistedstate`
- `userStore`: auth state (email, username, isAuthenticated)
- `orgStore`: projects/orgs/selectedProject with nested menu structure
- Call `orgStore.loadProjects()` after mutations to refresh UI

**Pattern**: Store actions call API, update state, trigger cascading loads:
```javascript
// In orgStore.js
async loadProjects() {
    const response = await axiosInstance.get('/', { headers: { action: 'get-projects' } });
    this.projects = response.data.data;
    await this.loadOrgs(); // Cascade load
    this.setMenuItems();   // Rebuild menu
}
```



### Authentication Flow
1. Login via `/auth/login` → server sets `auth_token` cookie
2. Frontend calls `/auth/whoami` → validates token
3. On success: `userStore.setIsAuthenticated(true)` + `orgStore.loadProjects()`
4. Router guards check `isLoggedIn()` composable (see [useAuth.js](../src/composables/auth/useAuth.js))



### Router Configuration
- Protected routes wrapped in `isLoggedIn()` guard
- Main app uses `AppLayout` component with sidebar navigation
- Route alias `'@'` resolves to `src/` via vite.config.mjs




## Backend Patterns


### Service Layer Architecture
All database operations go through services (in `SERVER/src/services/`):
```javascript
// Example: sfOrgService.js
const { SfOrg, Project } = require('../../models');

async function getSfOrgsByUserId(userId) {
    const projects = await Project.findAll({ where: { userId }, attributes: ['id'] });
    const projectIds = projects.map(p => p.id);
    return await SfOrg.findAll({ where: { projectId: projectIds } });
}
```

**Never query models directly in routes** - always use service functions.



### Response Format
Use `sendResponse()` utility for all responses:
```javascript
const sendResponse = require('../utils/sendResponse');
// sendResponse(res, statusCode, success, message, data?)
sendResponse(res, 200, true, 'Projects retrieved successfully', projects);
```



### Auth Middleware
- Validates JWT from `auth_token` cookie
- Appends `req.user` object (full User record) to request
- Returns 401/403 for invalid/expired tokens
- See [authMiddleware.js](../SERVER/src/middleware/authMiddleware.js)



### Environment Variables
Create `SERVER/src/.env`:
```
JWT_SECRET=your-secret-key
JWT_EXPIRATION=12h
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```




## Salesforce Integration (Future)
- **jsforce** installed but not yet used
- Planned: metadata retrieval, field mapping, data migration
- See [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) for detailed roadmap




## Code Style Conventions
- **Frontend**: ES6 imports, arrow functions, async/await
- **Backend**: CommonJS requires, async/await (no callbacks)
- **Naming**: camelCase for variables/functions, PascalCase for components/models
- **Error handling**: try/catch with console.error, return proper status codes
- **Sequelize queries**: Always specify `where` clause explicitly, use `attributes` to limit fields




## Common Gotchas
1. **Action headers required**: Forgot `headers: { action: '...' }` causes 400 Bad Request
2. **Two servers**: Must run both frontend (Vite) and backend (Node) separately
3. **Migrations before seeds**: Always migrate DB schema before running seeders
4. **Sensitive data masking**: SfOrg credentials masked in `get-orgs` endpoint (see [server.js](../SERVER/src/server.js) line 48-58)
5. **Auth cookie**: Set `withCredentials: true` in axiosInstance for auth endpoints
6. **Model paths**: Models in `SERVER/models/`, services reference as `../../models`




## Project Status
✅ Complete: User auth, project/org CRUD, DB schema, frontend layout
🚧 In Development: Salesforce metadata retrieval, field mapping UI, migration engine
📋 Planned: See Phase 2-5 in IMPLEMENTATION_PLAN.md
