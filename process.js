
export default async function handler(req, res) {
  // Allow CORS from our own domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'});

  const { pdfBase64 } = req.body;
  if (!pdfBase64) return res.status(400).json({error: 'No PDF provided'});

  const prompt = `Проанализируй смету PDF для натяжных потолков. Верни ТОЛЬКО валидный JSON (без markdown, без пояснений):
{"client":"имя клиента","address":"адрес объекта","technologist":"технолог","note":"примечание","total_area":"130.95m²","total_fabric":"133 875.00","total_extra":"1 471 871.17","grand_total":"1 605 746.17","rows1":[{"num":"1","name":"название позиции","qty":"6.38","unit":"m²","total":"6 380.00"}],"rows2":[{"num":"1","name":"название позиции","qty":"123.97","unit":"м.п.","total":"230 578.62"}]}
rows1=строки с полотнами(MSD EVOLUTION, Транслюцидное и т.д.)
rows2=строки раздела ДОПОЛНИТЕЛЬНЫЕ РАБОТЫ
Числа форматируй с пробелом как разделитель тысяч: 1 234 567.89`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({error: 'Claude API error: ' + err.slice(0, 200)});
    }

    const data = await response.json();
    const text = data.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch(e) {
    return res.status(500).json({error: e.message});
  }
}
