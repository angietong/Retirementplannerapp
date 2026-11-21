import Charts
import SwiftUI

struct ContentView: View {
    @State private var config = PlannerConfig.load()
    @State private var selectedTab = 0

    private var projection: [ProjectionYear] { ProjectionEngine.run(config) }
    private var startingBalance: Double { config.accounts.reduce(0) { $0 + $1.balance } }
    private var firstShortfall: ProjectionYear? { projection.first { $0.shortfall > 1 } }

    var body: some View {
        TabView(selection: $selectedTab) {
            overview
                .tabItem { Label("Overview", systemImage: "chart.xyaxis.line") }
                .tag(0)
            projectionView
                .tabItem { Label("Projection", systemImage: "list.bullet.rectangle") }
                .tag(1)
            planSetup
                .tabItem { Label("Plan setup", systemImage: "slider.horizontal.3") }
                .tag(2)
        }
        .tint(Color(red: 0.09, green: 0.45, blue: 0.34))
        .onChange(of: config) { _, newValue in newValue.save() }
    }

    private var overview: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("YOUR RETIREMENT SNAPSHOT").font(.caption.weight(.bold)).tracking(1.2).foregroundStyle(.secondary)
                        Text(config.name.isEmpty ? "A clearer view of retirement" : "Welcome, \(config.name)")
                            .font(.largeTitle.bold())
                        Text("Explore a baseline projection. Your plan is saved locally on this iPad.")
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                    .background(Color.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))

                    HStack(spacing: 12) {
                        metric("Starting portfolio", value: money(startingBalance))
                        metric("First-year spending", value: money(projection.first?.expenses ?? 0))
                    }
                    metric("Projected final balance", value: money(projection.last?.endingBalance ?? 0), subtitle: "\(projection.count)-year projection")

                    GroupBox {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("Portfolio over time").font(.headline)
                                Spacer()
                                Text(firstShortfall.map { "Shortfall in \($0.calendarYear)" } ?? "No modeled shortfall")
                                    .font(.caption).foregroundStyle(firstShortfall == nil ? .green : .orange)
                            }
                            Chart(projection) { row in
                                AreaMark(x: .value("Year", row.calendarYear), y: .value("Balance", row.endingBalance))
                                    .foregroundStyle(.green.opacity(0.12))
                                LineMark(x: .value("Year", row.calendarYear), y: .value("Balance", row.endingBalance))
                                    .foregroundStyle(.green).lineStyle(StrokeStyle(lineWidth: 3))
                            }
                            .frame(height: 220)
                            .chartYAxis { AxisMarks(position: .leading) }
                        }
                    }
                    Text("Educational estimate only—not tax, legal, or investment advice. This starter version uses simplified tax estimates and does not yet implement all specification features.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                .padding()
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Retirement planner")
        }
    }

    private var projectionView: some View {
        NavigationStack {
            List {
                Section("Year-by-year estimate") {
                    ForEach(projection) { row in
                        VStack(alignment: .leading, spacing: 7) {
                            HStack {
                                Text("\(row.calendarYear) · age \(row.age, specifier: "%.1f")").font(.headline)
                                Spacer()
                                Text(money(row.endingBalance)).font(.headline).monospacedDigit()
                            }
                            Text("Spending \(money(row.expenses))  ·  Income \(money(row.salary))  ·  Withdrawals \(money(row.withdrawals))")
                                .font(.caption).foregroundStyle(.secondary)
                            if row.shortfall > 1 {
                                Text("Estimated cash-flow shortfall: \(money(row.shortfall))").font(.caption.weight(.semibold)).foregroundStyle(.orange)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("Projection")
        }
    }

    private var planSetup: some View {
        NavigationStack {
            Form {
                Section("Household & timeline") {
                    TextField("Your name", text: $config.name)
                    TextField("Birth date (YYYY-MM-DD)", text: $config.birthDate)
                        .textInputAutocapitalization(.never)
                    TextField("Retirement date (YYYY-MM-DD)", text: $config.retirementDate)
                        .textInputAutocapitalization(.never)
                    numberField("Annual salary before retirement", value: $config.salary, format: .currency(code: "USD"))
                    Stepper("Projection: \(config.projectionYears) years", value: $config.projectionYears, in: 1...80)
                    numberField("Life expectancy", value: $config.lifeExpectancy, format: .number.precision(.fractionLength(0)))
                    Toggle("Include a spouse", isOn: $config.spouseEnabled)
                    if config.spouseEnabled {
                        TextField("Spouse birth date", text: $config.spouseBirthDate)
                        TextField("Spouse retirement date", text: $config.spouseRetirementDate)
                        numberField("Spouse annual salary", value: $config.spouseSalary, format: .currency(code: "USD"))
                    }
                }
                Section("Spending & assumptions") {
                    numberField("Monthly living costs", value: $config.monthlyLiving, format: .currency(code: "USD"))
                    numberField("Monthly pre-Medicare healthcare", value: $config.monthlyMedical, format: .currency(code: "USD"))
                    numberField("Monthly Medicare healthcare", value: $config.postMedicareMonthlyMedical, format: .currency(code: "USD"))
                    numberField("Medicare age", value: $config.medicareAge, format: .number.precision(.fractionLength(0)))
                    percentField("Investment return", value: $config.investmentReturn)
                    percentField("General inflation", value: $config.inflation)
                    percentField("Healthcare inflation", value: $config.medicalInflation)
                    percentField("Federal tax estimate", value: $config.federalRate)
                    percentField("State tax estimate", value: $config.stateRate)
                }
                Section {
                    ForEach($config.accounts) { $account in
                        VStack(alignment: .leading, spacing: 10) {
                            TextField("Account name", text: $account.name)
                            Picker("Type", selection: $account.kind) {
                                ForEach(AccountKind.allCases) { kind in Text(kind.rawValue).tag(kind) }
                            }
                            Picker("Owner", selection: $account.owner) {
                                ForEach(AccountOwner.allCases) { owner in Text(owner.rawValue).tag(owner) }
                            }
                            numberField("Balance", value: $account.balance, format: .currency(code: "USD"))
                            Stepper("Priority: \(account.priority)", value: $account.priority, in: 1...99)
                            numberField("Access age", value: $account.accessAge, format: .number.precision(.fractionLength(0)))
                        }
                        .padding(.vertical, 5)
                    }
                    .onDelete { config.accounts.remove(atOffsets: $0) }
                    Button { addAccount() } label: { Label("Add account", systemImage: "plus.circle.fill") }
                } header: { Text("Accounts") } footer: {
                    Text("Lower priority numbers are withdrawn first. Tax treatment and access ages are simplified in this starter projection.")
                }
            }
            .navigationTitle("Plan setup")
            .toolbar { EditButton() }
        }
    }

    private func metric(_ title: String, value: String, subtitle: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.title3.bold()).minimumScaleFactor(0.75).lineLimit(1)
            if let subtitle { Text(subtitle).font(.caption2).foregroundStyle(.secondary) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(15)
        .background(.background, in: RoundedRectangle(cornerRadius: 15))
    }

    private func numberField<F: ParseableFormatStyle>(_ title: String, value: Binding<Double>, format: F) -> some View where F.FormatInput == Double, F.FormatOutput == String {
        TextField(title, value: value, format: format).keyboardType(.decimalPad)
    }

    private func percentField(_ title: String, value: Binding<Double>) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField(title, value: Binding(get: { value.wrappedValue * 100 }, set: { value.wrappedValue = $0 / 100 }), format: .number.precision(.fractionLength(1)))
                .keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 90)
            Text("%")
        }
    }

    private func addAccount() {
        config.accounts.append(PlannerAccount(name: "New account", kind: .cash, owner: .primary, balance: 0, priority: (config.accounts.map(\.priority).max() ?? 0) + 1, accessAge: 0))
    }

    private func money(_ amount: Double) -> String {
        amount.formatted(.currency(code: "USD").precision(.fractionLength(0)))
    }
}
