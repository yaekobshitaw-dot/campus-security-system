const sendGsmSms = async () => {
  throw new Error('GSM SMS gateway is not configured. Connect a campus-owned GSM modem or Android SMS gateway before enabling SMS_PROVIDER=gsm.');
};

module.exports = { sendGsmSms };
