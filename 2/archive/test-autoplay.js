#!/usr/bin/env node

/**
 * Test Autoplay and Legend Minimize Features
 * Validates the new autoplay button and legend minimize functionality
 */

const fs = require('fs');
const path = require('path');

function testFile(filePath, description) {
  try {
    require('child_process').execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
    console.log(`✓ ${description}: ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    console.log(`✗ ${description}: ${path.basename(filePath)}`);
    return false;
  }
}

function testHTMLElement(filePath, elementId) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes(`id="${elementId}"`)) {
      console.log(`✓ HTML element found: ${elementId}`);
      return true;
    } else {
      console.log(`✗ HTML element NOT found: ${elementId}`);
      return false;
    }
  } catch (error) {
    console.log(`✗ Error reading HTML: ${error.message}`);
    return false;
  }
}

function testCSSClass(filePath, className) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes(`.${className}`)) {
      console.log(`✓ CSS class found: .${className}`);
      return true;
    } else {
      console.log(`✗ CSS class NOT found: .${className}`);
      return false;
    }
  } catch (error) {
    console.log(`✗ Error reading CSS: ${error.message}`);
    return false;
  }
}

function testJSMethod(filePath, methodName) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes(`${methodName}(`)) {
      console.log(`✓ JavaScript method found: ${methodName}()`);
      return true;
    } else {
      console.log(`✗ JavaScript method NOT found: ${methodName}()`);
      return false;
    }
  } catch (error) {
    console.log(`✗ Error reading JavaScript: ${error.message}`);
    return false;
  }
}

console.log('\n' + '='.repeat(60));
console.log('AUTOPLAY & LEGEND MINIMIZE FEATURE TEST');
console.log('='.repeat(60) + '\n');

// Test 1: Syntax Validation
console.log('\n[Test 1] Code Syntax Validation');
console.log('-'.repeat(60));
let passed1 = testFile('src/UIController.js', 'UIController.js');
let passed2 = testFile('src/main.js', 'main.js');
let syntaxPassed = passed1 && passed2;

// Test 2: HTML Structure
console.log('\n[Test 2] HTML Structure & Elements');
console.log('-'.repeat(60));
let passed3 = testHTMLElement('index.html', 'autoplayBtn');
let passed4 = testHTMLElement('index.html', 'speedSlider');
let passed5 = testHTMLElement('index.html', 'speedDisplay');
let passed6 = testHTMLElement('index.html', 'legendMinimizeBtn');
let passed7 = testHTMLElement('index.html', 'legendContent');
let htmlPassed = passed3 && passed4 && passed5 && passed6 && passed7;

// Test 3: CSS Styling
console.log('\n[Test 3] CSS Classes & Styling');
console.log('-'.repeat(60));
let passed8 = testCSSClass('styles.css', 'control-btn');
let passed9 = testCSSClass('styles.css', 'speed-control');
let passed10 = testCSSClass('styles.css', 'speed-slider');
let passed11 = testCSSClass('styles.css', 'minimize-btn');
let cssPassed = passed8 && passed9 && passed10 && passed11;

// Test 4: JavaScript Methods
console.log('\n[Test 4] JavaScript Methods & Handlers');
console.log('-'.repeat(60));
let passed12 = testJSMethod('src/UIController.js', 'toggleAutoplay');
let passed13 = testJSMethod('src/UIController.js', 'updateSpeed');
let passed14 = testJSMethod('src/UIController.js', 'toggleLegendMinimize');
let passed15 = testJSMethod('src/UIController.js', 'startAutoplayLoop');
let jsPassed = passed12 && passed13 && passed14 && passed15;

// Test 5: JavaScript Properties
console.log('\n[Test 5] JavaScript State Properties');
console.log('-'.repeat(60));
const uiControllerContent = fs.readFileSync('src/UIController.js', 'utf-8');
let passed16 = uiControllerContent.includes('this.isAutoplayActive');
let passed17 = uiControllerContent.includes('this.autoplaySpeed');
let passed18 = uiControllerContent.includes('this.autoplayInterval');
console.log(`${passed16 ? '✓' : '✗'} State property found: isAutoplayActive`);
console.log(`${passed17 ? '✓' : '✗'} State property found: autoplaySpeed`);
console.log(`${passed18 ? '✓' : '✗'} State property found: autoplayInterval`);
let propertiesPassed = passed16 && passed17 && passed18;

// Summary
console.log('\n' + '='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));

const allPassed = syntaxPassed && htmlPassed && cssPassed && jsPassed && propertiesPassed;

console.log(`Syntax Validation:     ${syntaxPassed ? '✓ PASSED' : '✗ FAILED'}`);
console.log(`HTML Structure:        ${htmlPassed ? '✓ PASSED' : '✗ FAILED'}`);
console.log(`CSS Styling:           ${cssPassed ? '✓ PASSED' : '✗ FAILED'}`);
console.log(`JavaScript Methods:    ${jsPassed ? '✓ PASSED' : '✗ FAILED'}`);
console.log(`State Properties:      ${propertiesPassed ? '✓ PASSED' : '✗ FAILED'}`);
console.log('\n' + '-'.repeat(60));

if (allPassed) {
  console.log('✓ ALL TESTS PASSED - Autoplay & Legend Minimize READY');
} else {
  console.log('✗ SOME TESTS FAILED - Review above for details');
}

console.log('='.repeat(60) + '\n');

process.exit(allPassed ? 0 : 1);
