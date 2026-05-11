(function () {
  const STORAGE_BUCKET = "receipts";

  const storeKey = "uber-property-v1";
  const todayIso = new Date().toISOString().slice(0, 10);
  const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const state = loadState();
  let supabaseClient = createSupabaseClient();

  const els = {
    tabs: document.querySelectorAll(".tab"),
    addTabs: document.querySelectorAll(".sub-tab"),
    addPanels: document.querySelectorAll("[data-add-panel-view]"),
    views: document.querySelectorAll("[data-view-panel]"),
    propertyForm: document.querySelector("#propertyForm"),
    expenseForm: document.querySelector("#expenseForm"),
    incomeForm: document.querySelector("#incomeForm"),
    recurringForm: document.querySelector("#recurringForm"),
    certificateForm: document.querySelector("#certificateForm"),
    settingsForm: document.querySelector("#settingsForm"),
    lettingsFeeMode: document.querySelector("#lettingsFeeMode"),
    propertySelects: document.querySelectorAll("select[name='property_id']"),
    propertyList: document.querySelector("#propertyList"),
    recentExpenses: document.querySelector("#recentExpenses"),
    recurringList: document.querySelector("#recurringList"),
    recurringManageList: document.querySelector("#recurringManageList"),
    recordsList: document.querySelector("#recordsList"),
    diaryList: document.querySelector("#diaryList"),
    propertyViewFilter: document.querySelector("#propertyViewFilter"),
    tenancyViewFilter: document.querySelector("#tenancyViewFilter"),
    propertyDetailPanel: document.querySelector("#propertyDetailPanel"),
    propertyRentLedger: document.querySelector("#propertyRentLedger"),
    propertyComplianceList: document.querySelector("#propertyComplianceList"),
    tenantDetailPanel: document.querySelector("#tenantDetailPanel"),
    tenantLedger: document.querySelector("#tenantLedger"),
    diaryPropertyFilter: document.querySelector("#diaryPropertyFilter"),
    recordPropertyFilter: document.querySelector("#recordPropertyFilter"),
    taxYearSelect: document.querySelector("#taxYearSelect"),
    taxReport: document.querySelector("#taxReport"),
    generateRecurringButton: document.querySelector("#generateRecurringButton"),
    exportCsvButton: document.querySelector("#exportCsvButton"),
    printReportButton: document.querySelector("#printReportButton"),
    syncButton: document.querySelector("#syncButton")
  };

  seedDemoData();
  bindEvents();
  setDefaultDates();
  render();

  function loadState() {
    const fallback = {
      properties: [],
      recurring: [],
      expenses: [],
      income: [],
      rentDue: [],
      certificates: [],
      generated: [],
      settings: defaultSettings()
    };
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) || "{}");
      return { ...fallback, ...saved, settings: { ...fallback.settings, ...(saved.settings || {}) } };
    } catch (error) {
      console.warn("Could not load local records", error);
      return fallback;
    }
  }

  function saveState() {
    localStorage.setItem(storeKey, JSON.stringify(state));
  }

  function createSupabaseClient() {
    const { supabase_url: url, supabase_anon_key: anonKey } = state?.settings || {};
    return window.supabase && url && anonKey
      ? window.supabase.createClient(url, anonKey)
      : null;
  }

  function seedDemoData() {
    if (state.properties.length) return;

    const propertyId = crypto.randomUUID();
    state.properties.push({
      id: propertyId,
      property_name: "Sample flat",
      address: "12 Example Street, Birmingham",
      tenant_name: "Demo tenant",
      tenant_phone: "07123 456789",
      tenant_email: "tenant@example.com",
      tenancy_start_date: todayIso.slice(0, 5) + "01-15",
      monthly_rent: 950,
      deposit_amount: 950,
      deposit_scheme: "DPS",
      mortgage_interest_monthly: 420,
      insurance_monthly: 28,
      management_fee_percentage: 8,
      status: "tenanted",
      notes: "Replace this sample record with your first property.",
      created_at: new Date().toISOString()
    });
    state.recurring.push(
      recurringFromProperty(propertyId, "Mortgage interest", "Monthly mortgage interest", 420),
      recurringFromProperty(propertyId, "Insurance", "Landlord insurance", 28),
      recurringFromProperty(propertyId, "Letting fees", "Management fee", 76)
    );
    state.income.push({
      id: crypto.randomUUID(),
      property_id: propertyId,
      date_received: todayIso,
      rent_period: todayIso.slice(0, 7),
      rent_due_date: todayIso.slice(0, 8) + "01",
      amount: 950,
      notes: "Sample rent receipt",
      created_at: new Date().toISOString()
    });
    state.rentDue.push({
      id: crypto.randomUUID(),
      property_id: propertyId,
      due_date: todayIso.slice(0, 8) + "01",
      period: todayIso.slice(0, 7),
      amount: 950,
      notes: "Sample monthly rent due",
      created_at: new Date().toISOString()
    });
    saveState();
  }

  function recurringFromProperty(propertyId, category, description, amount) {
    return {
      id: crypto.randomUUID(),
      property_id: propertyId,
      category,
      description,
      amount,
      frequency: "monthly",
      start_date: todayIso,
      active: true,
      created_at: new Date().toISOString()
    };
  }

  function bindEvents() {
    els.tabs.forEach((tab) => {
      tab.addEventListener("click", () => switchView(tab.dataset.view));
    });
    els.addTabs.forEach((tab) => {
      tab.addEventListener("click", () => switchAddPanel(tab.dataset.addPanel));
    });

    els.propertyForm.addEventListener("submit", handlePropertySubmit);
    els.expenseForm.addEventListener("submit", handleExpenseSubmit);
    els.incomeForm.addEventListener("submit", handleIncomeSubmit);
    els.recurringForm.addEventListener("submit", handleRecurringSubmit);
    els.certificateForm.addEventListener("submit", handleCertificateSubmit);
    els.settingsForm.addEventListener("submit", handleSettingsSubmit);
    els.lettingsFeeMode.addEventListener("change", renderSettingsFields);
    els.propertyViewFilter.addEventListener("change", renderPropertyView);
    els.tenancyViewFilter.addEventListener("change", renderTenancyView);
    els.diaryPropertyFilter.addEventListener("change", renderDiary);
    els.recordPropertyFilter.addEventListener("change", renderRecords);
    els.taxYearSelect.addEventListener("change", renderReports);
    els.generateRecurringButton.addEventListener("click", generateRecurringForMonth);
    els.exportCsvButton.addEventListener("click", exportCsv);
    els.printReportButton.addEventListener("click", () => window.print());
    els.syncButton.addEventListener("click", syncFromSupabase);
    document.addEventListener("click", handleRecordAction);
  }

  function setDefaultDates() {
    document.querySelectorAll("input[type='date']").forEach((input) => {
      if (!input.value) input.value = todayIso;
    });
    document.querySelectorAll("input[type='month']").forEach((input) => {
      if (!input.value) input.value = todayIso.slice(0, 7);
    });
  }

  function switchView(view) {
    els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
    els.views.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.viewPanel === view));
  }

  function switchAddPanel(panelName) {
    els.addTabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.addPanel === panelName));
    els.addPanels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.addPanelView === panelName));
  }

  async function handleRecordAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const { action, type, id } = button.dataset;
    if (action === "edit") {
      editRecord(type, id);
      return;
    }
    if (action === "delete") {
      await deleteRecord(type, id);
    }
  }

  function editRecord(type, id) {
    if (type === "properties") {
      populateForm(els.propertyForm, findById(state.properties, id), "Update property");
      switchView("capture");
      switchAddPanel("property");
      return;
    }
    if (type === "expenses") {
      populateForm(els.expenseForm, findById(state.expenses, id), "Update expense");
      switchView("capture");
      switchAddPanel("expense");
      return;
    }
    if (type === "income") {
      populateForm(els.incomeForm, findById(state.income, id), "Update income");
      switchView("capture");
      switchAddPanel("income");
      return;
    }
    if (type === "recurring") {
      populateForm(els.recurringForm, findById(state.recurring, id), "Update recurring cost");
      switchView("capture");
      switchAddPanel("recurring");
      return;
    }
    if (type === "certificates") {
      populateForm(els.certificateForm, findById(state.certificates, id), "Update diary item");
      switchView("diary");
      return;
    }
    if (type === "rentDue") {
      editRentDue(id);
    }
  }

  function populateForm(form, record, buttonText) {
    if (!record) return;
    Object.entries(record).forEach(([key, value]) => {
      const field = form.elements[key];
      if (!field || field.type === "file") return;
      field.value = value ?? "";
    });
    const submit = form.querySelector("button[type='submit']");
    if (submit) submit.textContent = buttonText;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function editRentDue(id) {
    const item = findById(state.rentDue, id);
    if (!item) return;
    const dueDate = window.prompt("Rent due date", item.due_date);
    if (!dueDate) return;
    const period = window.prompt("Rent period", item.period || dueDate.slice(0, 7));
    if (!period) return;
    const amount = window.prompt("Rent due amount", String(item.amount));
    if (!amount) return;
    item.due_date = dueDate;
    item.period = period;
    item.amount = numberValue(amount);
    await upsertSupabase("rent_due", item);
    saveState();
    render();
  }

  async function deleteRecord(type, id) {
    const config = recordConfig(type);
    if (!config) return;
    const item = findById(config.list, id);
    if (!item) return;
    if (!window.confirm(`Delete this ${config.label}?`)) return;
    removeById(config.list, id);
    if (type === "properties") {
      removePropertyChildren(id);
    }
    await deleteSupabase(config.table, id);
    saveState();
    render();
  }

  function removePropertyChildren(propertyId) {
    [state.recurring, state.expenses, state.income, state.rentDue, state.certificates].forEach((list) => {
      for (let index = list.length - 1; index >= 0; index -= 1) {
        if (list[index].property_id === propertyId) list.splice(index, 1);
      }
    });
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function defaultSettings() {
    return {
      lettings_fee_mode: "percentage",
      lettings_fee_percentage: 8,
      lettings_fee_fixed: 0,
      rent_due_day: 1,
      supabase_url: "",
      supabase_anon_key: "",
      portfolio_notes: ""
    };
  }

  async function handlePropertySubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    const existing = findById(state.properties, data.id);
    const property = {
      id: data.id || crypto.randomUUID(),
      property_name: data.property_name.trim(),
      address: data.address.trim(),
      tenant_name: data.tenant_name.trim(),
      tenant_phone: data.tenant_phone.trim(),
      tenant_email: data.tenant_email.trim(),
      tenancy_start_date: data.tenancy_start_date || null,
      monthly_rent: numberValue(data.monthly_rent),
      deposit_amount: numberValue(data.deposit_amount),
      deposit_scheme: data.deposit_scheme.trim(),
      mortgage_interest_monthly: numberValue(data.mortgage_interest_monthly),
      insurance_monthly: numberValue(data.insurance_monthly),
      management_fee_percentage: numberValue(data.management_fee_percentage),
      status: data.status,
      notes: data.notes.trim(),
      created_at: existing?.created_at || new Date().toISOString()
    };

    upsertLocal(state.properties, property);
    if (!data.id && property.mortgage_interest_monthly) {
      state.recurring.push(recurringFromProperty(property.id, "Mortgage interest", "Monthly mortgage interest", property.mortgage_interest_monthly));
    }
    if (!data.id && property.insurance_monthly) {
      state.recurring.push(recurringFromProperty(property.id, "Insurance", "Landlord insurance", property.insurance_monthly));
    }
    const lettingFee = calculateLettingsFee(property);
    if (!data.id && lettingFee > 0) {
      state.recurring.push(recurringFromProperty(property.id, "Letting fees", lettingFeeDescription(), lettingFee));
    }

    await upsertSupabase("properties", property);
    await saveRecurringToSupabase(property.id);
    completeForm(form);
  }

  async function handleExpenseSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    const receiptFile = form.elements.receipt_camera.files[0]
      || form.elements.receipt_file.files[0];
    const existing = findById(state.expenses, data.id);
    const expense = {
      id: data.id || crypto.randomUUID(),
      property_id: data.property_id,
      expense_date: data.expense_date,
      category: data.category,
      amount: numberValue(data.amount),
      supplier: data.supplier.trim(),
      notes: data.notes.trim(),
      receipt_url: receiptFile ? await uploadReceipt(receiptFile) : existing?.receipt_url || "",
      created_at: existing?.created_at || new Date().toISOString()
    };

    upsertLocal(state.expenses, expense);
    await upsertSupabase("expenses", expense);
    completeForm(form);
  }

  async function handleIncomeSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    const existing = findById(state.income, data.id);
    const income = {
      id: data.id || crypto.randomUUID(),
      property_id: data.property_id,
      date_received: data.date_received,
      rent_period: data.rent_period || data.date_received.slice(0, 7),
      rent_due_date: data.rent_due_date || `${data.rent_period || data.date_received.slice(0, 7)}-01`,
      amount: numberValue(data.amount),
      notes: data.notes.trim(),
      created_at: existing?.created_at || new Date().toISOString()
    };

    upsertLocal(state.income, income);
    await upsertSupabase("income", income);
    completeForm(form);
  }

  async function handleRecurringSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    const existing = findById(state.recurring, data.id);
    const recurring = {
      id: data.id || crypto.randomUUID(),
      property_id: data.property_id,
      category: data.category,
      description: data.description.trim(),
      amount: numberValue(data.amount),
      frequency: data.frequency,
      start_date: data.start_date,
      active: true,
      created_at: existing?.created_at || new Date().toISOString()
    };

    upsertLocal(state.recurring, recurring);
    const generated = data.id ? [] : buildRecurringExpensesForMonth([recurring]);
    state.expenses.push(...generated);
    await upsertSupabase("recurring_transactions", recurring);
    for (const expense of generated) {
      await upsertSupabase("expenses", expense);
    }
    completeForm(form);
  }

  async function handleCertificateSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    const documentFile = form.elements.document_file.files[0];
    const existing = findById(state.certificates, data.id);
    const certificate = {
      id: data.id || crypto.randomUUID(),
      property_id: data.property_id,
      certificate_type: data.certificate_type,
      issue_date: data.issue_date || null,
      expiry_date: data.expiry_date,
      reminder_date: data.reminder_date || suggestedReminderDate(data.expiry_date),
      notes: data.notes.trim(),
      document_url: documentFile ? await uploadDocument(documentFile) : existing?.document_url || "",
      created_at: existing?.created_at || new Date().toISOString()
    };

    upsertLocal(state.certificates, certificate);
    await upsertSupabase("certificates", certificate);
    completeForm(form);
  }

  function handleSettingsSubmit(event) {
    event.preventDefault();
    const data = formData(event.currentTarget);
    state.settings = {
      lettings_fee_mode: data.lettings_fee_mode,
      lettings_fee_percentage: numberValue(data.lettings_fee_percentage),
      lettings_fee_fixed: numberValue(data.lettings_fee_fixed),
      rent_due_day: Math.min(28, Math.max(1, Math.round(numberValue(data.rent_due_day) || 1))),
      supabase_url: data.supabase_url.trim(),
      supabase_anon_key: data.supabase_anon_key.trim(),
      portfolio_notes: data.portfolio_notes.trim()
    };
    supabaseClient = createSupabaseClient();
    saveState();
    render();
  }

  function calculateLettingsFee(property) {
    if (state.settings.lettings_fee_mode === "fixed") {
      return numberValue(state.settings.lettings_fee_fixed);
    }
    const percentage = property.management_fee_percentage || numberValue(state.settings.lettings_fee_percentage);
    return property.monthly_rent * percentage / 100;
  }

  function lettingFeeDescription() {
    if (state.settings.lettings_fee_mode === "fixed") {
      return `Lettings fixed fee ${money.format(state.settings.lettings_fee_fixed)}`;
    }
    return `Lettings commission ${state.settings.lettings_fee_percentage}%`;
  }

  function completeForm(form) {
    saveState();
    form.reset();
    form.querySelector("input[name='id']").value = "";
    const submit = form.querySelector("button[type='submit']");
    if (submit) submit.textContent = submit.textContent.replace("Update", "Save");
    setDefaultDates();
    render();
  }

  function numberValue(value) {
    return Number.parseFloat(value || "0") || 0;
  }

  async function uploadReceipt(file) {
    if (!file) return "";

    if (!supabaseClient) {
      return fileToDataUrl(file);
    }

    if (!(await ensureSupabaseSession(true))) return "";

    const cleanName = file.name.replace(/[^a-z0-9_.-]/gi, "-").toLowerCase();
    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${cleanName}`;
    const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false });
    if (error) {
      alert(`Receipt upload failed: ${error.message}`);
      return "";
    }
    const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function uploadDocument(file) {
    return uploadReceipt(file);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function upsertSupabase(table, row) {
    if (!supabaseClient) return;
    if (!(await ensureSupabaseSession(false))) return;
    const { error } = await supabaseClient.from(table).upsert(row);
    if (error) alert(`Supabase save failed: ${error.message}`);
  }

  async function deleteSupabase(table, id) {
    if (!supabaseClient) return;
    if (!(await ensureSupabaseSession(false))) return;
    const { error } = await supabaseClient.from(table).delete().eq("id", id);
    if (error) alert(`Supabase delete failed: ${error.message}`);
  }

  async function saveRecurringToSupabase(propertyId) {
    if (!supabaseClient) return;
    if (!(await ensureSupabaseSession(false))) return;
    const rows = state.recurring.filter((item) => item.property_id === propertyId);
    const { error } = await supabaseClient.from("recurring_transactions").upsert(rows);
    if (error) alert(`Supabase recurring save failed: ${error.message}`);
  }

  async function syncFromSupabase() {
    if (!supabaseClient) {
      alert("Add Supabase URL and anon key in app.js to enable cloud sync.");
      return;
    }

    if (!(await ensureSupabaseSession(true))) return;

    const tables = [
      ["properties", "properties"],
      ["recurring_transactions", "recurring"],
      ["expenses", "expenses"],
      ["income", "income"],
      ["rent_due", "rentDue"],
      ["certificates", "certificates"]
    ];
    for (const [table, key] of tables) {
      const { data, error } = await supabaseClient.from(table).select("*").order("created_at", { ascending: true });
      if (error) {
        alert(`Sync failed for ${table}: ${error.message}`);
        return;
      }
      state[key] = data || [];
    }
    saveState();
    render();
  }

  async function ensureSupabaseSession(promptForEmail) {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) return true;
    if (!promptForEmail) return false;

    const email = window.prompt("Enter your email to receive a Supabase sign-in link.");
    if (!email) return false;

    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href }
    });
    if (error) {
      alert(`Sign-in link failed: ${error.message}`);
      return false;
    }
    alert("Check your email for the sign-in link, then return here and tap sync.");
    return false;
  }

  async function generateRecurringForMonth() {
    const newExpenses = buildRecurringExpensesForMonth(state.recurring);
    const newRentDue = buildRentDueForMonth();
    state.expenses.push(...newExpenses);
    state.rentDue.push(...newRentDue);
    for (const expense of newExpenses) {
      await upsertSupabase("expenses", expense);
    }
    for (const rentDue of newRentDue) {
      await upsertSupabase("rent_due", rentDue);
    }
    saveState();
    render();
    const generatedCount = newExpenses.length + newRentDue.length;
    alert(generatedCount ? `Generated ${newRentDue.length} rent due and ${newExpenses.length} recurring expenses.` : "This month is already up to date.");
  }

  function buildRecurringExpensesForMonth(recurringItems) {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return recurringItems
      .filter((item) => item.active)
      .filter((item) => !state.generated.includes(`${item.id}-${monthKey}`))
      .filter((item) => item.start_date <= `${monthKey}-31`)
      .filter((item) => item.frequency === "monthly" || (item.frequency === "yearly" && item.start_date.slice(5, 7) === monthKey.slice(5, 7)))
      .map((item) => {
        state.generated.push(`${item.id}-${monthKey}`);
        return {
          id: crypto.randomUUID(),
          property_id: item.property_id,
          expense_date: `${monthKey}-01`,
          category: item.category,
          amount: item.amount,
          supplier: "Recurring",
          notes: item.description,
          receipt_url: "",
          created_at: new Date().toISOString()
        };
      });
  }

  function buildRentDueForMonth() {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return state.properties
      .filter((property) => property.status === "tenanted" && property.monthly_rent > 0)
      .filter((property) => !state.generated.includes(`rent-${property.id}-${monthKey}`))
      .map((property) => {
        state.generated.push(`rent-${property.id}-${monthKey}`);
        return {
          id: crypto.randomUUID(),
          property_id: property.id,
          due_date: `${monthKey}-${String(state.settings.rent_due_day).padStart(2, "0")}`,
          period: monthKey,
          amount: property.monthly_rent,
          notes: "Monthly rent due",
          created_at: new Date().toISOString()
        };
      });
  }

  function render() {
    renderPropertyOptions();
    renderSettings();
    renderDashboard();
    renderPropertyView();
    renderTenancyView();
    renderDiary();
    renderRecords();
    renderTaxYearOptions();
    renderReports();
  }

  function renderPropertyOptions() {
    const options = state.properties.map((property) => `<option value="${property.id}">${escapeHtml(property.property_name)}</option>`).join("");
    els.propertySelects.forEach((select) => {
      select.innerHTML = options || "<option value=''>Add a property first</option>";
    });

    els.recordPropertyFilter.innerHTML = `<option value="all">All properties</option>${options}`;
    els.diaryPropertyFilter.innerHTML = `<option value="all">All properties</option>${options}`;
    els.propertyViewFilter.innerHTML = options || "<option value=''>Add a property first</option>";
    els.tenancyViewFilter.innerHTML = options || "<option value=''>Add a property first</option>";
  }

  function renderSettings() {
    Object.entries(state.settings).forEach(([key, value]) => {
      const field = els.settingsForm.elements[key];
      if (field) field.value = value;
    });
    renderSettingsFields();
    const managementField = els.propertyForm.elements.management_fee_percentage;
    if (managementField && !managementField.value && state.settings.lettings_fee_mode === "percentage") {
      managementField.placeholder = String(state.settings.lettings_fee_percentage);
    }
  }

  function renderSettingsFields() {
    const mode = els.lettingsFeeMode.value || state.settings.lettings_fee_mode;
    document.querySelectorAll("[data-settings-field]").forEach((field) => {
      field.classList.toggle("is-hidden", field.dataset.settingsField !== mode);
    });
  }

  function renderDashboard() {
    const monthlyRent = sum(state.properties.filter((property) => property.status === "tenanted"), "monthly_rent");
    const recurring = state.recurring.filter((item) => item.active && item.frequency === "monthly").reduce((total, item) => total + item.amount, 0);
    const monthExpenses = state.expenses.filter((expense) => expense.expense_date.slice(0, 7) === todayIso.slice(0, 7));
    const adHoc = sum(monthExpenses.filter((expense) => expense.supplier !== "Recurring"), "amount");
    const rentBalances = state.properties.map((property) => propertyRentBalance(property.id));
    const totalRentBalance = rentBalances.reduce((total, balance) => total + balance.balance, 0);

    setText("#metricMonthlyRent", money.format(monthlyRent));
    setText("#metricRecurring", money.format(recurring));
    setText("#metricCashflow", money.format(monthlyRent - recurring - adHoc));
    setText("#metricRentBalance", money.format(totalRentBalance));

    els.propertyList.innerHTML = state.properties.map((property) => `
      <div class="property-card">
        <div>
          <strong>${escapeHtml(property.property_name)}</strong>
          <p class="meta">${escapeHtml(property.tenant_name || property.address || "No tenant")}</p>
          ${renderPropertyBalance(property.id)}
          ${actionButtons("properties", property.id)}
        </div>
        <div>
          <span class="badge">${property.status}</span>
          <p class="amount">${money.format(property.monthly_rent)}</p>
        </div>
      </div>
    `).join("") || emptyState();

    els.recentExpenses.innerHTML = [...state.expenses]
      .sort((a, b) => b.expense_date.localeCompare(a.expense_date))
      .slice(0, 6)
      .map((expense) => `
        <div class="transaction-row">
          <strong>${escapeHtml(expense.category)}</strong>
          <span class="amount out">${money.format(expense.amount)}</span>
          <span class="meta">${escapeHtml(propertyName(expense.property_id))} &middot; ${formatDate(expense.expense_date)}</span>
        </div>
      `).join("") || emptyState();

    els.recurringList.innerHTML = state.recurring
      .filter((item) => item.active)
      .sort((a, b) => propertyName(a.property_id).localeCompare(propertyName(b.property_id)))
      .map((item) => `
        <div class="transaction-row">
          <strong>${escapeHtml(item.category)}</strong>
          <span class="amount out">${money.format(item.amount)}</span>
          <span class="meta">${escapeHtml(propertyName(item.property_id))} &middot; ${item.frequency}</span>
          ${item.description ? `<span class="meta">${escapeHtml(item.description)}</span>` : ""}
          ${actionButtons("recurring", item.id)}
        </div>
      `).join("") || emptyState();

    els.recurringManageList.innerHTML = state.recurring
      .filter((item) => item.active)
      .sort((a, b) => propertyName(a.property_id).localeCompare(propertyName(b.property_id)))
      .map((item) => `
        <div class="transaction-row">
          <strong>${escapeHtml(item.category)}</strong>
          <span class="amount out">${money.format(item.amount)}</span>
          <span class="meta">${escapeHtml(propertyName(item.property_id))} &middot; ${item.frequency} from ${formatDate(item.start_date)}</span>
          ${item.description ? `<span class="meta">${escapeHtml(item.description)}</span>` : ""}
          ${actionButtons("recurring", item.id)}
        </div>
      `).join("") || emptyState();

    const current = currentTaxYear();
    const report = buildTaxReport(current.startYear);
    setText("#taxYearLabel", `${formatDate(current.start)} - ${formatDate(current.end)}`);
    setText("#taxIncome", money.format(report.income));
    setText("#taxExpenses", money.format(report.totalExpenses));
    setText("#taxProfit", money.format(report.profit));
  }

  function renderPropertyBalance(propertyId) {
    const balance = propertyRentBalance(propertyId);
    const status = rentBalanceStatus(balance);
    return `
      <p class="meta">Rent due ${money.format(balance.due)} &middot; paid ${money.format(balance.paid)}</p>
      <p class="meta">Latest due ${balance.latestDueDate ? formatDate(balance.latestDueDate) : "none"} &middot; last received ${balance.latestReceivedDate ? formatDate(balance.latestReceivedDate) : "none"}</p>
      <span class="balance-pill ${status.className}">${status.label}: ${money.format(Math.abs(balance.balance))}</span>
    `;
  }

  function renderPropertyView() {
    const property = selectedProperty(els.propertyViewFilter);
    if (!property) {
      els.propertyDetailPanel.innerHTML = emptyState();
      els.propertyRentLedger.innerHTML = emptyState();
      els.propertyComplianceList.innerHTML = emptyState();
      return;
    }

    const balance = propertyRentBalance(property.id);
    els.propertyDetailPanel.innerHTML = `
      <div class="detail-list">
        <div><span>Address</span><strong>${escapeHtml(property.address || "Not set")}</strong></div>
        <div><span>Tenant</span><strong>${escapeHtml(property.tenant_name || "Vacant")}</strong></div>
        <div><span>Tenancy start</span><strong>${property.tenancy_start_date ? formatDate(property.tenancy_start_date) : "Not set"}</strong></div>
        <div><span>Rent</span><strong>${money.format(property.monthly_rent)}</strong></div>
        <div><span>Deposit</span><strong>${money.format(property.deposit_amount || 0)}</strong></div>
        <div><span>Deposit scheme</span><strong>${escapeHtml(property.deposit_scheme || "Not set")}</strong></div>
        <div><span>Balance</span><strong>${money.format(balance.balance)}</strong></div>
      </div>
      ${actionButtons("properties", property.id)}
    `;

    els.propertyRentLedger.innerHTML = renderLedger(property.id);
    els.propertyComplianceList.innerHTML = renderComplianceForProperty(property.id);
  }

  function renderTenancyView() {
    const property = selectedProperty(els.tenancyViewFilter);
    if (!property) {
      els.tenantDetailPanel.innerHTML = emptyState();
      els.tenantLedger.innerHTML = emptyState();
      return;
    }

    els.tenantDetailPanel.innerHTML = `
      <div class="detail-list">
        <div><span>Tenant</span><strong>${escapeHtml(property.tenant_name || "Not set")}</strong></div>
        <div><span>Phone</span><strong>${escapeHtml(property.tenant_phone || "Not set")}</strong></div>
        <div><span>Email</span><strong>${escapeHtml(property.tenant_email || "Not set")}</strong></div>
        <div><span>Property</span><strong>${escapeHtml(property.property_name)}</strong></div>
        <div><span>Tenancy start</span><strong>${property.tenancy_start_date ? formatDate(property.tenancy_start_date) : "Not set"}</strong></div>
        <div><span>Monthly rent</span><strong>${money.format(property.monthly_rent)}</strong></div>
        <div><span>Deposit</span><strong>${money.format(property.deposit_amount || 0)}</strong></div>
        <div><span>Deposit scheme</span><strong>${escapeHtml(property.deposit_scheme || "Not set")}</strong></div>
      </div>
      ${actionButtons("properties", property.id)}
    `;

    els.tenantLedger.innerHTML = renderLedger(property.id);
  }

  function renderLedger(propertyId) {
    const ledger = [
      ...state.rentDue.filter((item) => item.property_id === propertyId).map((item) => ({ ...item, type: "Rent due", date: item.due_date })),
      ...state.income.filter((item) => item.property_id === propertyId).map((item) => ({ ...item, type: "Income", date: item.date_received }))
    ].sort((a, b) => b.date.localeCompare(a.date));

    return ledger.map((record) => `
      <article class="record-row">
        <div class="record-top">
          <div>
            <strong>${recordLabel(record)}</strong>
            <p class="meta">${formatDate(record.date)}</p>
          </div>
          <span class="amount ${record.type === "Rent due" ? "out" : ""}">${money.format(record.amount)}</span>
        </div>
        ${recordDateMeta(record)}
        ${record.notes ? `<span class="meta">${escapeHtml(record.notes)}</span>` : ""}
        ${actionButtons(recordActionType(record), record.id)}
      </article>
    `).join("") || emptyState();
  }

  function renderComplianceForProperty(propertyId) {
    return state.certificates
      .filter((item) => item.property_id === propertyId)
      .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
      .map((item) => {
        const status = certificateStatus(item.expiry_date, item.reminder_date);
        return `
          <article class="diary-row ${status.className}">
            <div class="diary-top">
              <div>
                <strong>${escapeHtml(item.certificate_type)}</strong>
                <p class="meta">Expires ${formatDate(item.expiry_date)}</p>
              </div>
              <span class="status-pill ${status.className.replace("is-", "")}">${status.label}</span>
            </div>
            ${item.issue_date ? `<span class="meta">Issued ${formatDate(item.issue_date)}</span>` : ""}
            ${item.reminder_date ? `<span class="meta">Reminder ${formatDate(item.reminder_date)}</span>` : ""}
            ${item.document_url ? `<a class="receipt-link" href="${item.document_url}" target="_blank" rel="noreferrer">Open certificate</a>` : ""}
            ${actionButtons("certificates", item.id)}
          </article>
        `;
      }).join("") || emptyState();
  }

  function selectedProperty(select) {
    const id = select.value || state.properties[0]?.id;
    if (id && select.value !== id) select.value = id;
    return state.properties.find((property) => property.id === id);
  }

  function renderRecords() {
    const filter = els.recordPropertyFilter.value || "all";
    const records = [
      ...state.rentDue.map((item) => ({ ...item, type: "Rent due", date: item.due_date })),
      ...state.income.map((item) => ({ ...item, type: "Income", date: item.date_received })),
      ...state.expenses.map((item) => ({ ...item, type: "Expense", date: item.expense_date }))
    ]
      .filter((item) => filter === "all" || item.property_id === filter)
      .sort((a, b) => b.date.localeCompare(a.date));

    els.recordsList.innerHTML = records.map((record) => `
      <article class="record-row">
        <div class="record-top">
          <div>
            <strong>${recordLabel(record)}</strong>
            <p class="meta">${escapeHtml(propertyName(record.property_id))} &middot; ${formatDate(record.date)}</p>
          </div>
          <span class="amount ${record.type === "Expense" || record.type === "Rent due" ? "out" : ""}">${money.format(record.amount)}</span>
        </div>
        ${record.supplier ? `<span class="meta">${escapeHtml(record.supplier)}</span>` : ""}
        ${recordDateMeta(record)}
        ${record.notes ? `<span class="meta">${escapeHtml(record.notes)}</span>` : ""}
        ${record.receipt_url ? `<a class="receipt-link" href="${record.receipt_url}" target="_blank" rel="noreferrer">Open receipt</a>` : ""}
        ${actionButtons(recordActionType(record), record.id)}
      </article>
    `).join("") || emptyState();
  }

  function recordDateMeta(record) {
    if (record.type === "Income") {
      return `<span class="meta">Received ${formatDate(record.date_received)} &middot; period ${escapeHtml(record.rent_period || record.date_received.slice(0, 7))} &middot; due ${formatDate(record.rent_due_date || `${record.date_received.slice(0, 7)}-01`)}</span>`;
    }
    if (record.type === "Rent due") {
      return `<span class="meta">Due ${formatDate(record.due_date)} &middot; period ${escapeHtml(record.period || record.due_date.slice(0, 7))}</span>`;
    }
    if (record.type === "Expense") {
      return `<span class="meta">Expense date ${formatDate(record.expense_date)}</span>`;
    }
    return "";
  }

  function renderDiary() {
    const filter = els.diaryPropertyFilter.value || "all";
    const records = state.certificates
      .filter((item) => filter === "all" || item.property_id === filter)
      .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));

    els.diaryList.innerHTML = records.map((item) => {
      const status = certificateStatus(item.expiry_date, item.reminder_date);
      return `
        <article class="diary-row ${status.className}">
          <div class="diary-top">
            <div>
              <strong>${escapeHtml(item.certificate_type)}</strong>
              <p class="meta">${escapeHtml(propertyName(item.property_id))} &middot; expires ${formatDate(item.expiry_date)}</p>
            </div>
            <span class="status-pill ${status.className.replace("is-", "")}">${status.label}</span>
          </div>
          ${item.issue_date ? `<span class="meta">Issued ${formatDate(item.issue_date)}</span>` : ""}
          ${item.reminder_date ? `<span class="meta">Reminder ${formatDate(item.reminder_date)}</span>` : ""}
          ${item.notes ? `<span class="meta">${escapeHtml(item.notes)}</span>` : ""}
          ${item.document_url ? `<a class="receipt-link" href="${item.document_url}" target="_blank" rel="noreferrer">Open certificate</a>` : ""}
          ${actionButtons("certificates", item.id)}
        </article>
      `;
    }).join("") || emptyState();
  }

  function renderTaxYearOptions() {
    const years = new Set([currentTaxYear().startYear]);
    [...state.income, ...state.expenses].forEach((item) => years.add(taxYearForDate(item.date_received || item.expense_date).startYear));
    const currentValue = els.taxYearSelect.value || String(currentTaxYear().startYear);
    els.taxYearSelect.innerHTML = [...years]
      .sort((a, b) => b - a)
      .map((year) => `<option value="${year}">${year}/${String(year + 1).slice(2)}</option>`)
      .join("");
    els.taxYearSelect.value = currentValue;
  }

  function renderReports() {
    const report = buildTaxReport(Number(els.taxYearSelect.value || currentTaxYear().startYear));
    els.taxReport.innerHTML = [
      ["Rental income", report.income],
      ["Mortgage interest", report.mortgageInterest],
      ["Repairs and maintenance", report.repairs],
      ["Insurance", report.insurance],
      ["Letting fees", report.lettingFees],
      ["Other expenses", report.otherExpenses],
      ["Total expenses", report.totalExpenses, "total"],
      ["Estimated taxable profit", report.profit, "total"]
    ].map(([label, value, type]) => `
      <div class="report-row ${type || ""}">
        <span>${label}</span>
        <strong>${money.format(value)}</strong>
      </div>
    `).join("");
  }

  function recordLabel(record) {
    if (record.type === "Income") return "Rent received";
    if (record.type === "Rent due") return "Rent due";
    return escapeHtml(record.category);
  }

  function recordActionType(record) {
    if (record.type === "Income") return "income";
    if (record.type === "Rent due") return "rentDue";
    return "expenses";
  }

  function actionButtons(type, id) {
    return `
      <div class="row-actions">
        <button class="secondary-button" type="button" data-action="edit" data-type="${type}" data-id="${id}">Edit</button>
        <button class="danger-button" type="button" data-action="delete" data-type="${type}" data-id="${id}">Delete</button>
      </div>
    `;
  }

  function buildTaxReport(startYear) {
    const start = `${startYear}-04-06`;
    const end = `${startYear + 1}-04-05`;
    const income = state.income.filter((item) => inRange(item.date_received, start, end));
    const expenses = state.expenses.filter((item) => inRange(item.expense_date, start, end));
    const categorySum = (needle) => expenses
      .filter((expense) => expense.category.toLowerCase().includes(needle))
      .reduce((total, expense) => total + expense.amount, 0);
    const mortgageInterest = categorySum("mortgage");
    const repairs = expenses
      .filter((expense) => /repair|maintenance|plumbing|electrical|boiler|painting|locksmith/i.test(expense.category + expense.notes))
      .reduce((total, expense) => total + expense.amount, 0);
    const insurance = categorySum("insurance");
    const lettingFees = expenses
      .filter((expense) => /letting|management/i.test(expense.category))
      .reduce((total, expense) => total + expense.amount, 0);
    const totalExpenses = sum(expenses, "amount");

    return {
      start,
      end,
      income: sum(income, "amount"),
      mortgageInterest,
      repairs,
      insurance,
      lettingFees,
      otherExpenses: Math.max(0, totalExpenses - mortgageInterest - repairs - insurance - lettingFees),
      totalExpenses,
      profit: sum(income, "amount") - totalExpenses
    };
  }

  function exportCsv() {
    const rows = [["type", "property", "record_date", "due_date", "received_date", "period", "category", "amount", "supplier", "notes", "document_url"]];
    state.rentDue.forEach((item) => rows.push(["rent_due", propertyName(item.property_id), item.due_date, item.due_date, "", item.period, "Rent due", item.amount, "", item.notes, ""]));
    state.income.forEach((item) => rows.push(["income", propertyName(item.property_id), item.date_received, item.rent_due_date || "", item.date_received, item.rent_period || "", "Rental income", item.amount, "", item.notes, ""]));
    state.expenses.forEach((item) => rows.push(["expense", propertyName(item.property_id), item.expense_date, "", "", "", item.category, item.amount, item.supplier, item.notes, item.receipt_url]));
    state.certificates.forEach((item) => rows.push(["certificate", propertyName(item.property_id), item.expiry_date, item.expiry_date, "", "", item.certificate_type, "", "", item.notes, item.document_url]));

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `uber-property-records-${todayIso}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function currentTaxYear() {
    return taxYearForDate(todayIso);
  }

  function propertyRentBalance(propertyId) {
    const dueItems = state.rentDue.filter((item) => item.property_id === propertyId);
    const paymentItems = state.income.filter((item) => item.property_id === propertyId);
    const due = sum(dueItems, "amount");
    const paid = sum(paymentItems, "amount");
    return {
      due,
      paid,
      balance: due - paid,
      latestDueDate: latestDate(dueItems, "due_date"),
      latestReceivedDate: latestDate(paymentItems, "date_received")
    };
  }

  function rentBalanceStatus(balance) {
    if (balance.balance < 0) return { label: "Credit", className: "credit" };
    if (balance.balance === 0) return { label: "Paid", className: "paid" };
    if (balance.paid > 0) return { label: "Part paid", className: "part-paid" };
    return { label: "Arrears", className: "arrears" };
  }

  function certificateStatus(expiryDate, reminderDate) {
    if (expiryDate < todayIso) return { label: "Expired", className: "is-expired" };
    if ((reminderDate && reminderDate <= todayIso) || daysUntil(expiryDate) <= 30) {
      return { label: "Due soon", className: "is-due" };
    }
    return { label: "In date", className: "" };
  }

  function suggestedReminderDate(expiryDate) {
    const date = new Date(`${expiryDate}T12:00:00`);
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 10);
  }

  function daysUntil(date) {
    const start = new Date(`${todayIso}T12:00:00`);
    const end = new Date(`${date}T12:00:00`);
    return Math.ceil((end - start) / 86400000);
  }

  function taxYearForDate(date) {
    const year = Number(date.slice(0, 4));
    const boundary = `${year}-04-06`;
    const startYear = date >= boundary ? year : year - 1;
    return { startYear, start: `${startYear}-04-06`, end: `${startYear + 1}-04-05` };
  }

  function inRange(date, start, end) {
    return date >= start && date <= end;
  }

  function propertyName(id) {
    return state.properties.find((property) => property.id === id)?.property_name || "Unknown property";
  }

  function recordConfig(type) {
    return {
      properties: { list: state.properties, table: "properties", label: "property" },
      expenses: { list: state.expenses, table: "expenses", label: "expense" },
      income: { list: state.income, table: "income", label: "income payment" },
      recurring: { list: state.recurring, table: "recurring_transactions", label: "recurring transaction" },
      rentDue: { list: state.rentDue, table: "rent_due", label: "rent due entry" },
      certificates: { list: state.certificates, table: "certificates", label: "compliance item" }
    }[type];
  }

  function findById(list, id) {
    return list.find((item) => item.id === id);
  }

  function upsertLocal(list, item) {
    const index = list.findIndex((existing) => existing.id === item.id);
    if (index >= 0) {
      list[index] = item;
      return;
    }
    list.push(item);
  }

  function removeById(list, id) {
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) list.splice(index, 1);
  }

  function sum(items, field) {
    return items.reduce((total, item) => total + numberValue(item[field]), 0);
  }

  function latestDate(items, field) {
    return items
      .map((item) => item[field])
      .filter(Boolean)
      .sort()
      .pop() || "";
  }

  function setText(selector, value) {
    document.querySelector(selector).textContent = value;
  }

  function formatDate(date) {
    return dateFormat.format(new Date(`${date}T12:00:00`));
  }

  function emptyState() {
    return document.querySelector("#emptyStateTemplate").innerHTML;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }
})();
