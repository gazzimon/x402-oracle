// Test file for x402-oracle landing page
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    console.log('Starting Playwright test...\n');

    const browser = await chromium.launch({
        headless: true
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Collect console messages
    const consoleMessages = [];
    const consoleErrors = [];

    page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    page.on('pageerror', err => {
        consoleErrors.push(err.message);
    });

    try {
        // Load the HTML file
        const htmlPath = path.join(__dirname, 'index.html');
        console.log('Loading page:', htmlPath);

        await page.goto(`file://${htmlPath}`, {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        console.log('Page loaded successfully!\n');

        // Wait for animations to start
        await page.waitForTimeout(1000);

        // Check if key elements exist
        const checks = [
            { selector: '.navbar', name: 'Navigation' },
            { selector: '.hero', name: 'Hero Section' },
            { selector: '#problem', name: 'Problem Section' },
            { selector: '#solution', name: 'Solution Section' },
            { selector: '#features', name: 'Features Section' },
            { selector: '#execution', name: 'Execution Output Section' },
            { selector: '#architecture', name: 'Architecture Section' },
            { selector: '#usecases', name: 'Use Cases Section' },
            { selector: '#why', name: 'Why It Matters Section' },
            { selector: '#powered', name: 'Powered By Section' },
            { selector: '#footer', name: 'Footer' },
            { selector: '#network-canvas', name: 'Network Background Canvas' },
            { selector: '.terminal-window', name: 'Terminal Window' },
            { selector: '.features-grid', name: 'Features Grid' },
            { selector: '.architecture-flow', name: 'Architecture Flow' }
        ];

        console.log('Element Check Results:');
        console.log('='.repeat(40));

        let allPassed = true;
        for (const check of checks) {
            const element = await page.$(check.selector);
            const status = element ? '✓' : '✗';
            console.log(`${status} ${check.name}`);
            if (!element) allPassed = false;
        }

        console.log('='.repeat(40));

        // Check page title
        const title = await page.title();
        console.log('\nPage Title:', title);

        // Check viewport size
        const viewport = await page.viewportSize();
        console.log('Viewport Size:', viewport.width, 'x', viewport.height);

        // Print console output
        console.log('\nConsole Messages:');
        console.log('-'.repeat(40));
        if (consoleMessages.length === 0) {
            console.log('No console messages');
        } else {
            consoleMessages.forEach(msg => {
                console.log(`[${msg.type}] ${msg.text}`);
            });
        }

        // Print errors
        if (consoleErrors.length > 0) {
            console.log('\n⚠ Console Errors Found:');
            console.log('-'.repeat(40));
            consoleErrors.forEach(err => console.log('ERROR:', err));
            console.log('\nTest Result: FAILED - Console errors detected');
        } else {
            console.log('\n✓ No console errors detected');
        }

        // Final result
        console.log('\n' + '='.repeat(40));
        if (allPassed && consoleErrors.length === 0) {
            console.log('✓ ALL TESTS PASSED');
        } else {
            console.log('✗ SOME TESTS FAILED');
        }
        console.log('='.repeat(40));

    } catch (error) {
        console.error('Test failed with error:', error.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
