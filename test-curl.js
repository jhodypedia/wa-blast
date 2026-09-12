import 'dotenv/config';
import axios from 'axios';

const baseUrl = (process.env.WHATSAPP_GATEWAY_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const apiKey = process.env.WHATSAPP_API_KEY;
const phoneNumber = process.env.WHATSAPP_PHONE_NUMBER;
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
        timeout: 70_000,
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