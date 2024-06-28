#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const inquirer = require('inquirer');

function getPackageDependencies() {
    const packagePath = path.resolve(process.cwd(), 'package.json');

    if (!fs.existsSync(packagePath)) {
        console.error('package.json dosyası bulunamadı.');
        process.exit(1);
    }

    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    return { dependencies, devDependencies };
}

function getLatestVersion(packageName) {
    return new Promise((resolve, reject) => {
        exec(`npm show ${packageName} version`, (err, stdout, stderr) => {
            if (err) {
                reject(`Error fetching version for ${packageName}: ${stderr}`);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

async function checkForUpdates(dependencies) {
    const updates = {};

    for (const [pkg, currentVersion] of Object.entries(dependencies)) {
        try {
            const latestVersion = await getLatestVersion(pkg);
            if (latestVersion !== currentVersion) {
                updates[pkg] = { current: currentVersion, latest: latestVersion };
            }
        } catch (error) {
            console.error(error);
        }
    }

    return updates;
}

function updatePackages(packages) {
    return new Promise((resolve, reject) => {
        exec(`npm install ${packages.join(' ')}`, (err, stdout, stderr) => {
            if (err) {
                reject(`Error updating packages: ${stderr}`);
            } else {
                resolve(stdout);
            }
        });
    });
}

async function main() {
    const { dependencies, devDependencies } = getPackageDependencies();

    console.log('Checking updates for dependencies...');
    const depUpdates = await checkForUpdates(dependencies);
    console.log('Checking updates for devDependencies...');
    const devDepUpdates = await checkForUpdates(devDependencies);

    const allUpdates = { ...depUpdates, ...devDepUpdates };

    const choices = Object.entries(allUpdates).map(([pkg, { current, latest }]) => ({
        name: `${pkg}: ${current} → ${latest}`,
        value: pkg,
    }));

    if (choices.length === 0) {
        console.log('All packages are up to date.');
        return;
    }

    const { packagesToUpdate } = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'packagesToUpdate',
            message: 'Select packages to update',
            choices,
        },
    ]);

    if (packagesToUpdate.length > 0) {
        console.log('Updating selected packages...');
        try {
            const updateResult = await updatePackages(packagesToUpdate);
            console.log('Packages updated successfully:', updateResult);
        } catch (error) {
            console.error(error);
        }
    } else {
        console.log('No packages selected for update.');
    }
}

main();
