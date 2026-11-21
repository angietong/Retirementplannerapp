import Foundation

enum ProjectionEngine {
    /// A transparent baseline projection. This initial version uses flat effective tax estimates;
    /// it is not a tax-return calculator and does not yet include every feature in the specification.
    static func run(_ config: PlannerConfig) -> [ProjectionYear] {
        let calendar = Calendar(identifier: .gregorian)
        let retirementDate = parseDate(config.retirementDate, calendar: calendar)
        let birthDate = parseDate(config.birthDate, calendar: calendar)
        let retirementYear = calendar.component(.year, from: retirementDate)
        let startingAge = age(birthDate, on: retirementDate)
        let spouseBirthDate = parseDate(config.spouseBirthDate, calendar: calendar)
        let spouseRetirementDate = parseDate(config.spouseRetirementDate, calendar: calendar)
        var balances = Dictionary(uniqueKeysWithValues: config.accounts.map { ($0.id, max(0, $0.balance)) })
        var generalInflation = 1.0
        var healthInflation = 1.0
        var rows: [ProjectionYear] = []

        for year in 0..<max(1, min(config.projectionYears, 80)) {
            if year > 0 {
                generalInflation *= 1 + config.inflation
                healthInflation *= 1 + config.medicalInflation
            }
            let calendarYear = retirementYear + year
            let primaryAge = (startingAge + Double(year) * 10).rounded() / 10
            let spouseAge = config.spouseEnabled
                ? age(spouseBirthDate, on: date(year: calendarYear, month: 7, day: 1, calendar: calendar))
                : 0
            let primaryWorkFraction = year == 0
                ? clamp(Double(calendar.ordinality(of: .day, in: .year, for: retirementDate)! - 1) / 365, 0, 1)
                : 0
            let primarySalary = year == 0 ? config.salary * primaryWorkFraction : 0
            let spouseSalary: Double
            if config.spouseEnabled {
                let spouseYear = calendar.component(.year, from: spouseRetirementDate)
                if calendarYear < spouseYear {
                    spouseSalary = config.spouseSalary
                } else if calendarYear == spouseYear {
                    let day = calendar.ordinality(of: .day, in: .year, for: spouseRetirementDate) ?? 1
                    spouseSalary = config.spouseSalary * clamp(Double(day - 1) / 365, 0, 1)
                } else {
                    spouseSalary = 0
                }
            } else {
                spouseSalary = 0
            }
            let salary = primarySalary + spouseSalary
            let medicareActive = primaryAge >= config.medicareAge || (config.spouseEnabled && spouseAge >= config.medicareAge)
            let medical = medicareActive ? config.postMedicareMonthlyMedical : config.monthlyMedical
            let expenses = config.monthlyLiving * 12 * generalInflation + medical * 12 * healthInflation

            let accessible = config.accounts
                .filter { account in
                    switch account.owner {
                    case .primary: return primaryAge >= account.accessAge
                    case .spouse: return config.spouseEnabled && spouseAge >= account.accessAge
                    case .joint: return max(primaryAge, spouseAge) >= account.accessAge
                    }
                }
                .sorted { $0.priority == $1.priority ? $0.id < $1.id : $0.priority < $1.priority }

            let generalTaxRate = clamp(config.federalRate + config.stateRate, 0, 0.9)
            let needAfterIncome = max(0, expenses - salary)
            var remainingNeed = needAfterIncome
            var withdrawals = 0.0
            var estimatedTaxes = 0.0
            for account in accessible {
                guard remainingNeed > 0.01, let balance = balances[account.id] else { continue }
                let marginalRate = account.kind == .fourOhOneK || account.kind == .ira
                    ? generalTaxRate
                    : account.kind == .brokerage ? config.capitalGainsRate * 0.6 : 0
                let grossNeeded = remainingNeed / max(0.1, 1 - marginalRate)
                let draw = min(balance, grossNeeded)
                balances[account.id] = balance - draw
                withdrawals += draw
                let tax = account.kind == .fourOhOneK || account.kind == .ira
                    ? draw * generalTaxRate
                    : account.kind == .brokerage ? draw * config.capitalGainsRate * 0.6 : 0
                estimatedTaxes += tax
                remainingNeed = max(0, remainingNeed - draw + tax)
            }
            for account in config.accounts {
                balances[account.id, default: 0] *= 1 + config.investmentReturn
            }
            let endingBalance = balances.values.reduce(0, +)
            let shortfall = max(0, remainingNeed)
            rows.append(ProjectionYear(
                year: year,
                calendarYear: calendarYear,
                age: primaryAge,
                expenses: expenses,
                salary: salary,
                withdrawals: withdrawals,
                estimatedTaxes: estimatedTaxes,
                endingBalance: endingBalance,
                shortfall: shortfall
            ))
            if primaryAge > config.lifeExpectancy && (!config.spouseEnabled || spouseAge > config.lifeExpectancy) { break }
        }
        return rows
    }

    private static func parseDate(_ value: String, calendar: Calendar) -> Date {
        let parts = value.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return Date(timeIntervalSince1970: 0) }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12)) ?? Date(timeIntervalSince1970: 0)
    }

    private static func date(year: Int, month: Int, day: Int, calendar: Calendar) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12)) ?? Date(timeIntervalSince1970: 0)
    }

    private static func age(_ birth: Date, on date: Date) -> Double {
        date.timeIntervalSince(birth) / (365.25 * 24 * 60 * 60)
    }

    private static func clamp(_ value: Double, _ minimum: Double, _ maximum: Double) -> Double {
        min(maximum, max(minimum, value))
    }
}
