#!/usr/bin/env node

/**
 * Build Verification Script
 * Checks if all required files are compiled properly
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying build output...');

const distPath = path.join(__dirname, '../dist');
const criticalFiles = [
  'app.js',
  'controllers/expensesController.js',
  'controllers/flokoutsController.js',
  'controllers/authController.js',
  'services/pushNotificationService.js',
  'config/database.js',
  'middleware/auth.js'
];

let allFilesPresent = true;

console.log(`📁 Checking dist directory: ${distPath}`);

if (!fs.existsSync(distPath)) {
  console.error('❌ Dist directory does not exist!');
  process.exit(1);
}

console.log('📋 Checking critical files:');

criticalFiles.forEach(file => {
  const filePath = path.join(distPath, file);
  const exists = fs.existsSync(filePath);
  
  if (exists) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${file} (${stats.size} bytes)`);
  } else {
    console.error(`❌ Missing: ${file}`);
    allFilesPresent = false;
  }
});

// List all files in services directory
const servicesPath = path.join(distPath, 'services');
if (fs.existsSync(servicesPath)) {
  console.log('\n📁 Files in services directory:');
  const serviceFiles = fs.readdirSync(servicesPath);
  serviceFiles.forEach(file => {
    console.log(`   📄 ${file}`);
  });
} else {
  console.error('\n❌ Services directory missing in dist/');
  allFilesPresent = false;
}

// List all files in controllers directory
const controllersPath = path.join(distPath, 'controllers');
if (fs.existsSync(controllersPath)) {
  console.log('\n📁 Files in controllers directory:');
  const controllerFiles = fs.readdirSync(controllersPath);
  controllerFiles.forEach(file => {
    console.log(`   📄 ${file}`);
  });
} else {
  console.error('\n❌ Controllers directory missing in dist/');
  allFilesPresent = false;
}

if (allFilesPresent) {
  console.log('\n✅ Build verification passed! All critical files present.');
  process.exit(0);
} else {
  console.error('\n❌ Build verification failed! Missing critical files.');
  process.exit(1);
} 