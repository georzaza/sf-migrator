/**
 * Test Setup for Backend Tests
 * Initializes test environment
 */

const path = require('path');

process.env.NODE_ENV = 'test';
require('dotenv').config({
	path: path.resolve(__dirname, '../.env.test'),
});
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';

console.log('\n⚡ Test environment initialized\n');
