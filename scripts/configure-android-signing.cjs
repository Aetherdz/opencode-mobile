#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const gradlePath = 'app/android/app/build.gradle';
const required = [
  'ANDROID_KEYSTORE_PATH',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
];

for (const name of required) {
  if (!process.env[name]) {
    console.error(`::error::${name} is not configured.`);
    process.exit(1);
  }
}

let gradle = fs.readFileSync(gradlePath, 'utf8');

if (!gradle.includes('signingConfigs {')) {
  throw new Error('signingConfigs block not found in app/android/app/build.gradle');
}

if (!gradle.includes('signingConfigs.release')) {
  const releaseSigning = `
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    `;
  gradle = gradle.replace('signingConfigs {', `signingConfigs {${releaseSigning}`);
}

// Replace only the release build type. A plain string replace would hit the
// debug build type first and leave release debug-signed.
const buildTypesIndex = gradle.indexOf('buildTypes {');
if (buildTypesIndex === -1) {
  throw new Error('buildTypes block not found');
}
const buildTypesHead = gradle.slice(0, buildTypesIndex);
let buildTypes = gradle.slice(buildTypesIndex);
const releaseDebugSigning = /release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/;
if (!releaseDebugSigning.test(buildTypes)) {
  throw new Error('release build type does not reference signingConfigs.debug');
}
buildTypes = buildTypes.replace(releaseDebugSigning, (match) =>
  match.replace('signingConfigs.debug', 'signingConfigs.release'),
);

if (!/release\s*\{[\s\S]*?signingConfigs\.release/.test(buildTypes)) {
  throw new Error('release signing config was not applied');
}

fs.writeFileSync(gradlePath, buildTypesHead + buildTypes);
console.log('Release signing config applied.');
