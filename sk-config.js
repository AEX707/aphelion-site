// 白崎堂 Partner Portal — settings. Fill in once.
window.SK = {
  // Supabase → Project Settings → API
  SUPABASE_URL: 'https://hsayrvqqzsnzuxvvunju.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_OfWxhmj063hGYrP-qo6SSQ_yRoVHd79',

  // Version of the partner terms (change it when the terms change)
  TERMS_VERSION: '1.0',

  // Printed on every invoice (請求書)
  ISSUER: {
    name: '白崎堂 SHIROSAKI-DO',
    operator: '',                 // 運営会社名 (legal entity), e.g. '〇〇株式会社'
    address: '',                  // 住所
    email: 'info@shirosakido.jp',
    invoice_reg_no: '',           // 適格請求書発行事業者登録番号 T + 13 digits (leave empty if none)
    bank: ''                      // 振込先: 銀行名 支店名 普通 1234567 名義
  },
  TAX_RATE: 0.10
};
