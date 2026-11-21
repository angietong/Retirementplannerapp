import Foundation

enum AccountKind: String, CaseIterable, Codable, Identifiable {
    case cash = "Cash"
    case brokerage = "Brokerage"
    case fourOhOneK = "401(k)"
    case ira = "Traditional IRA"
    case roth = "Roth"
    case other = "Other"

    var id: String { rawValue }

    var defaultAccessAge: Double {
        switch self {
        case .fourOhOneK: 55
        case .ira, .roth: 60
        default: 0
        }
    }

    var estimatedTaxRate: Double {
        switch self {
        case .fourOhOneK, .ira: 0.27
        case .brokerage: 0.09
        default: 0
        }
    }
}

enum AccountOwner: String, CaseIterable, Codable, Identifiable {
    case primary = "You"
    case spouse = "Spouse"
    case joint = "Joint"
    var id: String { rawValue }
}

struct PlannerAccount: Codable, Identifiable {
    var id = UUID().uuidString
    var name: String
    var kind: AccountKind
    var owner: AccountOwner
    var balance: Double
    var priority: Int
    var accessAge: Double

    static let examples = [
        PlannerAccount(name: "Cash and savings", kind: .cash, owner: .primary, balance: 50_000, priority: 1, accessAge: 0),
        PlannerAccount(name: "Taxable brokerage", kind: .brokerage, owner: .primary, balance: 250_000, priority: 2, accessAge: 0),
        PlannerAccount(name: "401(k)", kind: .fourOhOneK, owner: .primary, balance: 800_000, priority: 3, accessAge: 55),
        PlannerAccount(name: "Roth IRA", kind: .roth, owner: .primary, balance: 150_000, priority: 4, accessAge: 60)
    ]
}

struct PlannerConfig: Codable, Equatable {
    var name = ""
    var birthDate = "1970-06-15"
    var retirementDate = "2030-07-01"
    var salary = 150_000.0
    var spouseEnabled = false
    var spouseBirthDate = "1972-04-20"
    var spouseRetirementDate = "2032-07-01"
    var spouseSalary = 95_000.0
    var projectionYears = 40
    var lifeExpectancy = 90.0
    var monthlyLiving = 5_500.0
    var monthlyMedical = 1_100.0
    var postMedicareMonthlyMedical = 500.0
    var medicareAge = 65.0
    var investmentReturn = 0.06
    var inflation = 0.025
    var medicalInflation = 0.045
    var federalRate = 0.22
    var stateRate = 0.05
    var capitalGainsRate = 0.15
    var accounts = PlannerAccount.examples

    static let storageKey = "retirement-planner.swift.v1"

    static func load() -> PlannerConfig {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let value = try? JSONDecoder().decode(PlannerConfig.self, from: data) else {
            return PlannerConfig()
        }
        return value
    }

    func save() {
        guard let data = try? JSONEncoder().encode(self) else { return }
        UserDefaults.standard.set(data, forKey: Self.storageKey)
    }
}

struct ProjectionYear: Identifiable {
    var year: Int
    var calendarYear: Int
    var age: Double
    var expenses: Double
    var salary: Double
    var withdrawals: Double
    var estimatedTaxes: Double
    var endingBalance: Double
    var shortfall: Double
    var id: Int { year }
}
