// netlify/functions/rpp-ai.js
export default async (req, context) => {
  try {
    const body = await req.json();
    const {
      jenjang = 'MI', madrasah = '', mapel = '', kelas = '',
      alokasi = '', model_pedagogis = '', materi_pokok = '', topik = '',
      tp_singkat = ''
    } = body || {};

    if(!materi_pokok || !tp_singkat){
      return new Response(JSON.stringify({ error: 'materi_pokok & tp_singkat wajib' }), { status: 400 });
    }

    const sys = `
Anda asisten kurikulum MI. Susun RPP lengkap sesuai kerangka:
IDENTIFIKASI (Kesiapan,dpl,KBC topik, KBC insersi) | DESAIN (CP, Lintas, Tujuan/TP, Praktik, Kemitraan, Lingkungan, Digital)
PENGALAMAN (Awal; Inti: Memahami, Mengaplikasi, Merefleksi; Penutup) | ASESMEN (Awal, Proses, Akhir).
Kembalikan HANYA JSON dgn properti:
{kesiapan,dpl,kbcTopik,kbcInsersi,cp,lintas,tp,praktik,kemitraan,lingkungan,digital,awal,memahami,mengaplikasi,merefleksi,penutup,asesmenAwal,asesmenProses,asesmenAkhir}.
Bahasa Indonesia, ringkas, kontekstual MI, sesuai materi & TP. Hindari PII.`;

    const usr = `
Konteks:
- Jenjang: ${jenjang}
- Madrasah: ${madrasah}
- Mapel: ${mapel}
- Kelas/Semester: ${kelas}
- Alokasi Waktu: ${alokasi}
- Model Pedagogis: ${model_pedagogis}
- Materi Pokok: ${materi_pokok}
- Topik/Konteks: ${topik}
- TP singkat: ${tp_singkat}
`;

    const PROVIDER = (process.env.PROVIDER || 'azure').toLowerCase();
    let resultText = '';

    if(PROVIDER === 'azure'){
      // Azure OpenAI (env di Netlify dashboard)
      const endpoint = process.env.AZURE_OPENAI_ENDPOINT; // ex: https://xxx.openai.azure.com
      const apiKey   = process.env.AZURE_OPENAI_API_KEY;
      const dep      = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini';
      const url = `${endpoint}/openai/deployments/${dep}/chat/completions?api-version=2024-08-01-preview`;

      const res = await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'api-key': apiKey },
        body: JSON.stringify({
          temperature: 0.5, max_tokens: 1100,
          messages:[ { role:'system', content: sys }, { role:'user', content: usr } ]
        })
      });
      const json = await res.json();
      resultText = json?.choices?.[0]?.message?.content || '';
    } else {
      // OpenAI (env di Netlify dashboard)
      const apiKey = process.env.OPENAI_API_KEY;
      const model  = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model, temperature: 0.5, max_tokens: 1100,
          messages:[ { role:'system', content: sys }, { role:'user', content: usr } ]
        })
      });
      const json = await res.json();
      resultText = json?.choices?.[0]?.message?.content || '';
    }

    const match = resultText.match(/\{[\s\S]*\}$/);
    const cleaned = match ? match[0] : resultText;
    const data = JSON.parse(cleaned);

    return Response.json(data);
  } catch (err) {
    console.error('RPP-AI error:', err);
    return new Response(JSON.stringify({ error: 'AI error', detail: String(err?.message||err) }), { status: 500 });
  }
};
