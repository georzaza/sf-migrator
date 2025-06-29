const { Project } = require('../../models');

async function getProjectById(id) {
    return await Project.findByPk(id);
}

async function getProjectsByUserId(userId) {
    return await Project.findAll({ where: { userId } });
}

async function createProject(projectData) {
    const project = await Project.create(projectData);
    console.log('Project created:', project);
    return project;
}

async function getAllProjects() {
    return await Project.findAll();
}

module.exports = {
    getProjectById,
    getProjectsByUserId,
    createProject,
    getAllProjects,
};
