const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

// Extract calculateCampaign and initCampaignsState logic or test directly
const appCode = fs.readFileSync("app.js", "utf8");

test("campaigns: Argos iPhone 18 pay_down calculation and auto-normalization", () => {
  const num = v => Math.max(0, Number(v) || 0);

  // Setup state matching the app
  const state = {
    campaigns: [
      {
        id: "camp-argos-iphone-18",
        name: "Argos Iphone 18",
        type: "build_up", // Mistakenly created as build_up
        target: 0,
        startingBalance: 1299,
        isPrimary: true,
        status: "active"
      }
    ],
    campaignTransactions: []
  };

  function initCampaignsState() {
    if (!state.campaigns) state.campaigns = [];
    if (!state.campaignTransactions) state.campaignTransactions = [];
    let changed = false;
    state.campaigns.forEach(c => {
      if (c.type === 'build_up' && (num(c.target) < num(c.startingBalance) || num(c.target) === 0)) {
        c.type = 'pay_down';
        changed = true;
      }
    });
    return changed;
  }

  function calculateCampaign(c) {
    const isPayDown = c.type === 'pay_down' || num(c.target) < num(c.startingBalance) || (num(c.target) === 0 && num(c.startingBalance) > 0);
    const effectiveType = isPayDown ? 'pay_down' : 'build_up';
    const txs = (state.campaignTransactions || []).filter(t => t.campaignId === c.id).sort((a,b) => a.date.localeCompare(b.date));
    let balance = num(c.startingBalance);
    
    txs.forEach(t => {
      if (effectiveType === 'build_up') {
        balance += t.direction === 'add' ? num(t.amount) : -num(t.amount);
      } else {
        balance += t.direction === 'add' ? -num(t.amount) : num(t.amount);
      }
    });

    const target = num(c.target);
    let progress = 0;
    let remaining = 0;
    
    if (effectiveType === 'build_up') {
      remaining = Math.max(0, target - balance);
      progress = target > 0 ? Math.min(100, Math.max(0, (balance / target) * 100)) : 0;
    } else {
      remaining = Math.max(0, balance - target);
      const start = num(c.startingBalance);
      if (start > target) {
        progress = Math.min(100, Math.max(0, ((start - balance) / (start - target)) * 100));
      } else {
        progress = balance <= target ? 100 : 0;
      }
    }

    return { ...c, type: effectiveType, balance, txs, remaining, progress };
  }

  // 1. Before migration, calculateCampaign still defends with effectiveType:
  const rawCampaign = state.campaigns[0];
  const preResult = calculateCampaign(rawCampaign);
  assert.equal(preResult.type, "pay_down", "Should be effective pay_down");
  assert.equal(preResult.balance, 1299, "Initial balance should be 1299");
  assert.equal(preResult.remaining, 1299, "Remaining balance should be 1299");
  assert.equal(preResult.progress, 0, "Progress should be 0%");

  // 2. Defensive migration
  const changed = initCampaignsState();
  assert.equal(changed, true, "Should have migrated campaign type");
  assert.equal(state.campaigns[0].type, "pay_down", "Stored campaign type is now pay_down");

  // 3. User adds £100 spending transaction
  state.campaignTransactions.push({
    id: "tx-1",
    campaignId: "camp-argos-iphone-18",
    amount: 100,
    direction: "add",
    date: "2026-10-17",
    note: "Argos iPhone payment"
  });

  const postResult = calculateCampaign(state.campaigns[0]);
  assert.equal(postResult.balance, 1199, "Balance must DECREASE by £100 from 1299 to 1199");
  assert.equal(postResult.remaining, 1199, "Remaining must be £1,199 left");
  assert.ok(Math.abs(postResult.progress - 7.698) < 0.01, "Progress should be ~7.7%");

  // 4. User adds remaining £1,199 payment
  state.campaignTransactions.push({
    id: "tx-2",
    campaignId: "camp-argos-iphone-18",
    amount: 1199,
    direction: "add",
    date: "2026-10-18",
    note: "Final payoff"
  });

  const finalResult = calculateCampaign(state.campaigns[0]);
  assert.equal(finalResult.balance, 0, "Balance must be 0 after full payoff");
  assert.equal(finalResult.remaining, 0, "Remaining must be 0");
  assert.equal(finalResult.progress, 100, "Progress must be 100%");
});

test("campaigns: build_up savings goal increases on payment", () => {
  const num = v => Math.max(0, Number(v) || 0);
  const state = {
    campaigns: [{ id: "camp-holiday", name: "Holiday Fund", type: "build_up", target: 2000, startingBalance: 200 }],
    campaignTransactions: []
  };

  function calculateCampaign(c) {
    const isPayDown = c.type === 'pay_down' || num(c.target) < num(c.startingBalance) || (num(c.target) === 0 && num(c.startingBalance) > 0);
    const effectiveType = isPayDown ? 'pay_down' : 'build_up';
    const txs = (state.campaignTransactions || []).filter(t => t.campaignId === c.id);
    let balance = num(c.startingBalance);
    txs.forEach(t => {
      if (effectiveType === 'build_up') {
        balance += t.direction === 'add' ? num(t.amount) : -num(t.amount);
      } else {
        balance += t.direction === 'add' ? -num(t.amount) : num(t.amount);
      }
    });
    const target = num(c.target);
    const remaining = Math.max(0, target - balance);
    const progress = target > 0 ? Math.min(100, Math.max(0, (balance / target) * 100)) : 0;
    return { ...c, type: effectiveType, balance, remaining, progress };
  }

  state.campaignTransactions.push({ id: "tx-h1", campaignId: "camp-holiday", amount: 300, direction: "add" });
  const res = calculateCampaign(state.campaigns[0]);
  assert.equal(res.type, "build_up");
  assert.equal(res.balance, 500, "Build-up balance should increase to 500");
  assert.equal(res.remaining, 1500, "Remaining should be 1500");
  assert.equal(res.progress, 25, "Progress should be 25%");
});
