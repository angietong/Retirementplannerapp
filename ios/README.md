# Native iPad app — SwiftUI

This directory contains a fresh native SwiftUI implementation. It does not import the existing web application's source. The first increment includes a local household/account setup screen, device-only persistence, a deterministic baseline projection, and a portfolio chart. The detailed functional specification remains the target; advanced tax and analysis features are not implemented yet.

## Requirements

- A Mac with Xcode 16 or newer (the project targets iPadOS 17+).
- An iPad running iPadOS 17 or newer to install on a physical device; a simulator is included with Xcode.
- An Apple ID/team selected under Xcode's Signing & Capabilities to run on a physical iPad. Paid Apple Developer membership is needed for App Store distribution, not just local development.

## Run on a simulator or iPad

1. Open `ios/RetirementPlanner.xcodeproj` in Xcode.
2. Select the `RetirementPlanner` scheme and an iPad simulator, or connect and select your iPad.
3. For a physical device, choose your development team in the target's **Signing & Capabilities** settings.
4. Press **Run**. Xcode downloads/builds the app the first time; the installed app itself needs no internet connection.

The app has no network calls or third-party packages. Plan settings are encoded in `UserDefaults` on the device. Deleting the app may remove its local plan data, so keep a separate record of important inputs.

## Current scope

The projection is an illustrative baseline, not a financial or tax calculator. Subsequent implementation should add tested modules for the full spec: guaranteed income, major expenses, owner-specific access milestones, tax-aware gross-up, RMD tables/enforcement, spouse drawdown balancing, Roth conversions, ACA estimation, stress/Monte Carlo, strategy comparisons, real-dollar mode, and CSV/XLSX exports. Resolve the specification's assumptions and edge cases and validate them with deterministic test scenarios before relying on outputs.
