/**
 * Project Repository - Database operations for Project model
 */

const { Project } = require('../../models');
const logger = require('../lib/logger');
const log = logger.create('projectRepository');

async function findById(id) {
    return Project.findByPk(id);
}

async function findByUserId(userId) {
    return Project.findAll({ where: { userId } });
}

async function create(projectData) {
    const project = await Project.create(projectData);
    log.info('Project created', { projectId: project.id, name: project.name });
    return project;
}

async function update(id, projectData) {
    const project = await Project.findByPk(id);
    if (!project) {
        throw new Error('Project not found');
    }
    const updatedProject = await project.update(projectData);
    log.info('Project updated', { projectId: id, name: updatedProject.name });
    return updatedProject;
}

async function remove(id) {
    const project = await Project.findByPk(id);
    if (!project) {
        throw new Error('Project not found');
    }
    await project.destroy();
    log.info('Project deleted', { projectId: id });
}

async function findAll() {
    return Project.findAll();
}

module.exports = {
    findById,
    findByUserId,
    create,
    update,
    delete: remove,
    findAll,
};
