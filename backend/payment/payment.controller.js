// Payment Controller
const { paymentRepository } = require('../lib/repositories.js');

const checkout = async (req, res) => {
  try {
    const { amount, currency, item } = req.body || {};
    if (!amount) {
      return res.status(400).json({ message: 'amount is required' });
    }

    const payment = await paymentRepository.createCheckout({
      userId: req.user?.id,
      amount,
      currency,
      item,
    });
    return res.json(payment);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const webhook = async (req, res) => {
  try {
    const webhookRecord = await paymentRepository.handleWebhook(req.body || {});
    return res.json({ message: 'Webhook received', webhook: webhookRecord });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const retryPayment = async (req, res) => {
  try {
    const payment = await paymentRepository.retryPayment(req.params.paymentId, req.user?.id);
    if (payment === null) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment === false) {
      return res.status(403).json({ message: 'Cannot retry payment for another user' });
    }

    return res.json(payment);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  checkout,
  webhook,
  retryPayment,
};
