import axios from 'axios';

const baseUrl = (process.env.WHATSAPP_GATEWAY_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const apiKey = "ps-7f8f945d634154c72505aef47e37e1d14b68a9c45fa0b3f1";
const phoneNumber = "6283129635860";
const label = process.env.WHATSAPP_SESSION_LABEL ?? 'Axios pairing test';

if (!apiKey || !phoneNumber) {
  console.error('Set WHATSAPP_API_KEY and WHATSAPP_PHONE_NUMBER before running this script.');
  process.exitCode = 1;
} else {
  try {
    const response = await axios.post(
      `${baseUrl}/session/start/pairing`,
      { phoneNumber, label },
      {
        headers: { 'x-api-key': apiKey },
        timeout: 30_000,
      },
    );

    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(JSON.stringify({
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      }, null, 2));
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  }
}