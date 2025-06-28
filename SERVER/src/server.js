const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/authMiddleware');

const userService = require('./services/userService');
const projectService = require('./services/projectsService');
const sfOrgService = require('./services/sfOrgService');

const sendResponse = require('./utils/sendResponse');

const PORT = process.env.PORT || 3000;

require('dotenv').config();

const app = express();

app.use(express.json());

app.use(cors ({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // allow requests from VUE frontend only. For Prod, update to actual domain
    credentials: true
}));

app.use('/auth', authRoutes);


// ===================== GET Requests =====================
// uncomment the next line to enable authMiddleware
app.get("/", authMiddleware, async (req, res) => {

    /** get-projects */
    if (req.headers.action.toLowerCase() === 'get-projects') {
        const user = req.user;
        try {
            const projects = await projectService.getProjectsByUserId(user.id);
            sendResponse(res, 200, true, 'Projects retrieved successfully', projects);
        }
        catch (error) {
            console.error('Error retrieving projects:', error);
            sendResponse(res, 500, false, 'Failed to retrieve projects');
        }
    }

    /** get-orgs */
    else if (req.headers.action.toLowerCase() === 'get-orgs') {
        const user = req.user;
        try {
            const sfOrgs = await sfOrgService.getSfOrgsByUserId(user.id);
            sfOrgs.map(org => {
                // Mask sensitive information
                org.username = '*'.repeat(10);
                org.password = '*'.repeat(10);
                org.securityToken = '*'.repeat(10);
                org.clientId = '*'.repeat(10);
                org.clientSecret = '*'.repeat(10);
                return org;
            })
            sendResponse(res, 200, true, 'Salesforce Orgs retrieved successfully', sfOrgs);
        }
        catch (error) {
            console.error('Error retrieving Salesforce Orgs:', error);
            sendResponse(res, 500, false, 'Failed to retrieve Salesforce Orgs');
        }
    }
    else {
        res.status(400).json({ msg: 'Unknown GET action' });
    }
});



// ===================== POST Requests =====================
app.post("/", authMiddleware, async (req, res) => {
    /** get-orgs-for-project */
    if (req.headers.action.toLowerCase() === 'get-orgs-for-project') {
        //const user = req.user;
        const projectId = req.body.projectId;
        if (!projectId) {
            return sendResponse(res, 400, false, 'Project ID is required');
        }
        try {
            const sfOrgs = await sfOrgService.getSfOrgsByProjectId(projectId);
            sendResponse(res, 200, true, 'Salesforce Orgs for project retrieved successfully', sfOrgs);
        }
        catch (error) {
            console.error('Error retrieving Salesforce Orgs for project:', error);
            sendResponse(res, 500, false, 'Failed to retrieve Salesforce Orgs for project');
        }
    }

    else {
        res.send(['Invalid Unknown POST Action']);
        res.end();
    }
});


// ===================== PUT Requests =====================
app.put("/", authMiddleware, async (req, res) => {

    /** update-org */
    if (req.headers.action.toLowerCase() === 'update-org') {
        const orgId = req.headers.orgid;

        try {
            const org = await sfOrgService.updateSfOrg(orgId, req.body);
            sendResponse(res, 200, true, 'Salesforce Org updated successfully');
        }
        catch (error) {
            console.error('Error updating Salesforce Org:', error);
            sendResponse(res, 500, false, 'Failed to update Salesforce Org');
        }
    }
    else {
        res.status(400).json({ msg: 'Unknown PUT action' });
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
