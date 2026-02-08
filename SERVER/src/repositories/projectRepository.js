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

async function findAll() {
    return Project.findAll();
}

module.exports = {
    findById,
    findByUserId,
    create,
    findAll,
};
