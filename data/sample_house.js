/* ============================================================
   サンプル家歴：架空の戸建て住宅（木造2階建て・2013年4月引渡し）
   ※ 実在の住宅・人物・業者とは関係のない架空のデータです。
   ※ lifeYears（対応年数）は一般的な目安として仮置きした値です。
      実際の交換・更新時期は、製品の仕様・設置環境・施工会社の診断で確認してください。

   日付は "YYYY-MM"。
   persons（1行＝1項目）
     birth      取得・設置（購入）        death   廃棄・交換・終了（省略＝使用中）
     lifeYears  対応年数（目安）           cost    取得費用（円）
     records    履歴・予定  { date, type, name, cost, vendor, note, planned }
                type = repair 修繕 / reform 増改築・リフォーム / inspect 点検 / warranty 契約・保証・保険
     cycleYears 周期メンテナンス。最後の実施日から自動で「予定」を作る（cycleType / cycleName）
     succeeds   交換前の項目名（金色の破線でつなぐ）
     startLabel / endLabel   ▲・✕ の呼び名（例：竣工・引渡し、保証満了）
   住人（resident: true）
     birth      入居（または誕生）           death   転出・死亡（省略＝居住中）
     born       生年月（年齢の計算に使う）    startType: 'birth' / endType: 'death' で誕生・死亡の記号にする
     records の type = marriage 結婚 / enroll 入園・入学 / graduate 卒園・卒業 / career 就職・転職 / birth / death
   ============================================================ */
DATASETS.sample_house = {
  kind: 'home',
  monthly: true,
  name: 'サンプル邸（木造2階建て）',
  period: '2012年9月〜現在',
  unit: '項目',
  horizonYears: 15,            // 現在からこの年数先までを表示範囲にする
  labels: { age: '年', lifespan: '使用期間', agePanel: 'その時点の経過年数' },

  categories: {
    '住人':           '#d81b60',
    '契約・権利':     '#7f8c8d',
    '構造・外装':     '#2471a3',
    '設備':           '#c0392b',
    '内装・水まわり': '#27ae60',
    '家電・備品':     '#e67e22',
    '外構・敷地':     '#16a085',
  },

  persons: [
    /* ── 住人 ───────────────────────────────── */
    { name: '父（世帯主）', title: '住人｜会社員', cat: '住人', resident: true,
      birth: '2013-04', born: '1981-06', startLabel: '入居',
      records: [
        { date: '2012-05', type: 'marriage', name: '結婚' },
        { date: '2019-04', type: 'career',   name: '転職' },
      ] },

    { name: '母', title: '住人｜パート勤務', cat: '住人', resident: true,
      birth: '2013-04', born: '1983-09', startLabel: '入居',
      records: [
        { date: '2012-05', type: 'marriage', name: '結婚' },
        { date: '2021-04', type: 'career',   name: '職場復帰（パート）' },
      ] },

    { name: '長男', title: '住人｜2014年生まれ', cat: '住人', resident: true,
      birth: '2014-06', born: '2014-06', startType: 'birth', startLabel: '誕生',
      records: [
        { date: '2018-04', type: 'enroll',   name: '入園（保育園）' },
        { date: '2020-03', type: 'graduate', name: '卒園' },
        { date: '2020-04', type: 'enroll',   name: '入学（小学校）' },
        { date: '2026-03', type: 'graduate', name: '卒業（小学校）' },
        { date: '2026-04', type: 'enroll',   name: '入学（中学校）' },
        { date: '2029-03', type: 'graduate', name: '卒業（中学校）' },
        { date: '2029-04', type: 'enroll',   name: '入学（高校）' },
        { date: '2032-03', type: 'graduate', name: '卒業（高校）' },
        { date: '2032-04', type: 'enroll',   name: '入学（大学）' },
        { date: '2036-03', type: 'graduate', name: '卒業（大学）' },
      ],
      note: '2026年11月時点で中学1年。未来の日付の入学・卒業は進路の見込みで、予定として表示されます。' },

    { name: '長女', title: '住人｜2017年生まれ', cat: '住人', resident: true,
      birth: '2017-02', born: '2017-02', startType: 'birth', startLabel: '誕生',
      records: [
        { date: '2019-04', type: 'enroll',   name: '入園（幼稚園）' },
        { date: '2023-03', type: 'graduate', name: '卒園' },
        { date: '2023-04', type: 'enroll',   name: '入学（小学校）' },
        { date: '2029-03', type: 'graduate', name: '卒業（小学校）' },
        { date: '2029-04', type: 'enroll',   name: '入学（中学校）' },
        { date: '2032-03', type: 'graduate', name: '卒業（中学校）' },
        { date: '2032-04', type: 'enroll',   name: '入学（高校）' },
        { date: '2035-03', type: 'graduate', name: '卒業（高校）' },
      ] },

    { name: '祖母', title: '住人｜同居', cat: '住人', resident: true,
      birth: '2016-10', born: '1944-11', death: '2024-03',
      startLabel: '同居開始', endType: 'death', endLabel: '死亡',
      note: '1階の和室で生活。2016年10月に同居を開始。' },

    /* ── 契約・権利 ─────────────────────────── */
    { name: '土地', title: '権利｜135㎡・所有権', cat: '契約・権利',
      birth: '2012-09', cost: 28000000, vendor: 'サンプル不動産',
      note: '登記識別情報・測量図などの書類は別途保管。' },

    { name: '住宅ローン', title: '契約｜フラット35・35年返済', cat: '契約・権利',
      birth: '2013-04', death: '2048-03', startLabel: '融資実行', endLabel: '完済',
      records: [
        { date: '2013-04', type: 'warranty', name: '融資実行（借入 3,000万円）' },
      ],
      note: '完済予定は2048年3月。' },

    { name: '火災保険', title: '保険｜5年更新', cat: '契約・権利',
      birth: '2013-04', startLabel: '契約開始',
      records: [
        { date: '2018-04', type: 'warranty', name: '更新', cost: 85000 },
        { date: '2023-04', type: 'warranty', name: '更新', cost: 91000 },
      ],
      cycleYears: 5, cycleType: 'warranty', cycleName: '更新' },

    { name: '瑕疵担保保証（10年）', title: '保証｜住宅瑕疵担保責任保険', cat: '契約・権利',
      birth: '2013-04', death: '2023-04', lifeYears: 10,
      startLabel: '保証開始（引渡し）', endLabel: '保証満了',
      note: '構造耐力上主要な部分・雨水の浸入を防止する部分が対象。' },

    /* ── 構造・外装 ─────────────────────────── */
    { name: '建物本体', title: '木造2階建て・延床105㎡', cat: '構造・外装',
      birth: '2013-04', lifeYears: 50, cost: 35000000, vendor: 'サンプル工務店',
      startLabel: '竣工・引渡し',
      records: [
        { date: '2014-04', type: 'inspect', name: '1年点検' },
        { date: '2015-04', type: 'inspect', name: '2年点検' },
        { date: '2018-04', type: 'inspect', name: '5年点検' },
        { date: '2020-03', type: 'reform',  name: '2階 子ども部屋の間仕切りを増設', cost: 650000, vendor: 'サンプル工務店' },
        { date: '2023-04', type: 'inspect', name: '10年点検' },
      ],
      cycleYears: 5, cycleType: 'inspect', cycleName: '定期点検（5年ごと）',
      note: '定期点検は入居1年・2年・5年・10年、以降5年ごとが目安。' },

    { name: '屋根（スレート）', title: '屋根材｜コロニアル', cat: '構造・外装',
      birth: '2013-04', lifeYears: 30,
      records: [
        { date: '2019-10', type: 'repair', name: '台風で雨樋が破損 → 部分交換', cost: 85000, vendor: 'サンプル板金' },
        { date: '2024-06', type: 'repair', name: '屋根の塗装（外壁と同時施工）', cost: 650000, vendor: 'サンプル塗装店' },
      ],
      cycleYears: 10, cycleType: 'repair', cycleName: '屋根の再塗装' },

    { name: '外壁塗装（新築時）', title: '窯業系サイディング｜初回塗膜', cat: '構造・外装',
      birth: '2013-04', death: '2024-06', lifeYears: 12,
      startLabel: '新築', endLabel: '再塗装で更新',
      records: [
        { date: '2021-05', type: 'repair', name: 'シーリングの打ち替え（部分）', cost: 180000, vendor: 'サンプル塗装店' },
      ] },

    { name: '外壁塗装（2回目）', title: 'シリコン塗料｜2回目', cat: '構造・外装',
      birth: '2024-06', lifeYears: 12, cost: 1180000, vendor: 'サンプル塗装店',
      succeeds: '外壁塗装（新築時）', startLabel: '塗装完了',
      records: [
        { date: '2025-06', type: 'inspect', name: '1年点検（塗膜・シーリング）' },
      ] },

    { name: '防蟻処理（新築時）', title: '土台・床下｜保証5年', cat: '構造・外装',
      birth: '2013-04', death: '2018-06', lifeYears: 5,
      startLabel: '新築時に施工', endLabel: '再処理で更新' },

    { name: '防蟻処理（2回目）', title: '再処理｜保証5年', cat: '構造・外装',
      birth: '2018-06', lifeYears: 5, cost: 210000, vendor: 'サンプル防蟻',
      succeeds: '防蟻処理（新築時）', startLabel: '再処理完了',
      note: '保証期間（5年）が切れています。床下点検と再処理を検討してください。' },

    /* ── 設備 ───────────────────────────────── */
    { name: 'ガス給湯器', title: '給湯器｜初代・24号', cat: '設備',
      birth: '2013-04', death: '2023-09', lifeYears: 10, cost: 180000,
      endLabel: '故障のため交換',
      records: [
        { date: '2019-12', type: 'repair', name: '点火不良で部品交換', cost: 28000 },
      ] },

    { name: 'エコキュート', title: '給湯器｜370L', cat: '設備',
      birth: '2023-09', lifeYears: 15, cost: 560000, vendor: 'サンプル設備',
      succeeds: 'ガス給湯器',
      cycleYears: 5, cycleType: 'inspect', cycleName: '貯湯タンクの排水・点検' },

    { name: 'エアコン（リビング）初代', title: '14畳用', cat: '設備',
      birth: '2013-04', death: '2025-07', lifeYears: 13, cost: 138000,
      endLabel: '冷媒漏れのため買い替え' },

    { name: 'エアコン（リビング）2代目', title: '14畳用', cat: '設備',
      birth: '2025-07', lifeYears: 13, cost: 165000,
      succeeds: 'エアコン（リビング）初代' },

    { name: '24時間換気システム', title: '第3種換気', cat: '設備',
      birth: '2013-04', lifeYears: 20,
      records: [
        { date: '2020-04', type: 'inspect', name: 'フィルター清掃' },
        { date: '2023-04', type: 'inspect', name: 'フィルター清掃' },
        { date: '2026-04', type: 'inspect', name: 'フィルター清掃' },
      ],
      cycleYears: 3, cycleType: 'inspect', cycleName: 'フィルター清掃' },

    /* ── 内装・水まわり ─────────────────────── */
    { name: 'システムキッチン', title: '間口255cm', cat: '内装・水まわり',
      birth: '2013-04', lifeYears: 20,
      records: [
        { date: '2022-02', type: 'repair', name: '水栓の交換', cost: 38000 },
      ] },

    { name: 'ユニットバス', title: '1616サイズ', cat: '内装・水まわり',
      birth: '2013-04', lifeYears: 25,
      records: [
        { date: '2021-11', type: 'repair', name: '浴室暖房乾燥機の交換', cost: 135000 },
      ] },

    { name: 'トイレ（1階）', title: 'タンク式', cat: '内装・水まわり',
      birth: '2013-04', lifeYears: 15,
      records: [
        { date: '2018-09', type: 'repair', name: '温水洗浄便座の交換', cost: 45000 },
      ] },

    /* ── 家電・備品 ─────────────────────────── */
    { name: '冷蔵庫（初代）', title: '400L', cat: '家電・備品',
      birth: '2013-04', death: '2022-11', lifeYears: 10, cost: 98000,
      endLabel: '買い替え（リサイクル回収）' },

    { name: '冷蔵庫（2代目）', title: '465L', cat: '家電・備品',
      birth: '2022-11', lifeYears: 10, cost: 178000,
      succeeds: '冷蔵庫（初代）' },

    { name: 'ドラム式洗濯乾燥機', title: '洗濯11kg', cat: '家電・備品',
      birth: '2020-05', lifeYears: 8, cost: 215000,
      records: [
        { date: '2024-02', type: 'inspect', name: '内部清掃・点検', cost: 18000 },
      ] },

    /* ── 外構・敷地 ─────────────────────────── */
    { name: 'カーポート', title: '2台用・ポリカーボネート屋根', cat: '外構・敷地',
      birth: '2013-06', lifeYears: 20, cost: 260000,
      records: [
        { date: '2021-10', type: 'repair', name: '台風で屋根材が破損 → 交換', cost: 92000 },
      ] },

    { name: '門扉・フェンス', title: 'アルミ形材', cat: '外構・敷地',
      birth: '2013-04', lifeYears: 20 },
  ],

  events: [
    { year: '2012-09', name: '土地を購入' },
    { year: '2013-04', name: '竣工・引渡し／入居' },
    { year: '2019-10', name: '台風で雨樋が破損' },
    { year: '2020-03', name: '子ども部屋を増設' },
    { year: '2023-04', name: '10年点検・保証が満了' },
    { year: '2023-09', name: '給湯器を交換' },
    { year: '2024-06', name: '外壁・屋根を塗装' },
    { year: '2028-04', name: '15年点検' },
  ],

  emperors: [],
  retired: [],
};
