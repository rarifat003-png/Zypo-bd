export default async function handler(req, res) {
  const API_KEY = process.env.BUSINESS_KORO_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API Key পাওয়া যায়নি। Vercel-এ BUSINESS_KORO_API_KEY সেট করুন।' });
  }

  try {
    const response = await fetch('https://api.businesskoro.com/api/v1/storefront/products', {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'প্রোডাক্ট লোড করতে সমস্যা হয়েছে।' });
  }
}
