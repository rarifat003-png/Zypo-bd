module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const API_KEY = process.env.BUSINESS_KORO_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'Vercel-এ BUSINESS_KORO_API_KEY সেট করা নেই!' });
  }

  try {
    const apiRes = await fetch('https://api.businesskoro.com/api/v1/storefront/products', {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    const data = await apiRes.json();
    return res.status(apiRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'API ফেচ করতে ব্যর্থ: ' + err.message });
  }
};
