// Payment provider registry.
//
// Every provider implements the same small interface:
//   id, label, description
//   isEnabled()            → boolean
//   isSimulated()          → boolean (test mode)
//   start(order, input)    → { reference, meta, message }
//   query(reference, meta) → { status: 'processing'|'paid'|'failed', message?, receipt? }
//   parseCallback?(body)   → { reference, status, message, receipt, amount }
//
// To add a provider later (e.g. card payments via Pesapal, Flutterwave,
// Paystack or Stripe), create payments/<name>.js implementing the interface
// and register it below — the checkout UI lists enabled providers automatically.
import mpesa from './mpesa.js';

const card = {
  id: 'card',
  label: 'Card',
  description: 'Visa & Mastercard — coming soon.',
  isEnabled: () => false,
  isSimulated: () => false,
  async start() { const e = new Error('Card payments are not available yet.'); e.status = 400; throw e; },
  async query() { return { status: 'failed', message: 'Not available.' }; },
};

const providers = { mpesa, card };

export function getProvider(id) {
  return providers[id] || null;
}

export function listProviders() {
  return Object.values(providers).map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    enabled: p.isEnabled(),
    testMode: p.isSimulated(),
  }));
}
