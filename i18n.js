/* ============================================================
   i18n — Multi-language support
   Supported: zh-TW (Traditional Chinese), en (English),
              es (Spanish), ja (Japanese)
   ============================================================ */

const I18N = (() => {
  const translations = {
    "zh-TW": {
      // Idle screen
      "idle.title": "你的訊號傳輸速度有多快。",
      "idle.subtitle": "按下開始 · 約需25秒",
      "btn.start": "開始",

      // Testing phases
      "phase.ping": "Ping",
      "phase.download": "下載",
      "phase.upload": "上傳",
      "phase.measuring": "測量延遲中",

      // Units
      "unit.ms": "ms",
      "unit.mbps": "Mbps",

      // Testing metrics
      "metric.peak": "尖峰",
      "metric.avg": "平均",
      "metric.elapsed": "已用時間",
      "btn.cancel": "取消",

      // Result screen
      "result.complete": "測速完成",
      "result.headline": "你的連線已<em>鑄造</em>。",
      "result.download": "下載",
      "result.upload": "上傳",
      "result.ping": "Ping",
      "result.jitter": "抖動",
      "result.drag": "拖曳 · 滾動",
      "result.capability": "// 性能",
      "result.note": "// 說明",
      "btn.runAgain": "再測一次",
      "btn.share": "分享",

      // Capability labels
      "cap.hdCall": "HD 通話",
      "cap.1080p": "1080p",
      "cap.4k": "4K HDR",
      "cap.gaming": "雲端遊戲",
      "cap.8k": "8K 多路",
      "cap.pro": "專業 · VR",

      // Disclaimer
      "disclaimer": "已測量至Cloudflare全球邊緣。企業防火牆可能會限制上傳到未列入白名單的端點。",

      // Drawer
      "drawer.history": "歷史紀錄",
      "drawer.historyTitle": "測試紀錄",
      "drawer.about": "關於",
      "drawer.aboutTitle": "Ultimate Speed Test",

      // Grade titles
      "grade.a": "優秀",
      "grade.b": "良好",
      "grade.c": "中等",
      "grade.d": "較差",
      "grade.f": "極差",
      "grade.pending": "待測",

      // Share
      "share.text": "Ultimate Speed Test",
      "share.card.title": "ULTIMATE / SPEED TEST",
      "share.download": "下載",
      "share.upload": "上傳",
      "share.ping": "Ping",
    },

    en: {
      "idle.title": "How fast does your signal travel.",
      "idle.subtitle": "Press to begin · Takes ~25s",
      "btn.start": "START",

      "phase.ping": "Ping",
      "phase.download": "Download",
      "phase.upload": "Upload",
      "phase.measuring": "MEASURING LATENCY",

      "unit.ms": "ms",
      "unit.mbps": "Mbps",

      "metric.peak": "PEAK",
      "metric.avg": "AVG",
      "metric.elapsed": "ELAPSED",
      "btn.cancel": "Cancel",

      "result.complete": "BENCHMARK COMPLETE",
      "result.headline": "Your connection,<br /><em>forged.</em>",
      "result.download": "DOWNLOAD",
      "result.upload": "UPLOAD",
      "result.ping": "PING",
      "result.jitter": "JITTER",
      "result.drag": "DRAG · SCROLL",
      "result.capability": "// CAPABILITY",
      "result.note": "// NOTE",
      "btn.runAgain": "Run Again",
      "btn.share": "Share",

      "cap.hdCall": "HD Call",
      "cap.1080p": "1080p",
      "cap.4k": "4K HDR",
      "cap.gaming": "Cloud Gaming",
      "cap.8k": "8K Multi",
      "cap.pro": "Pro · VR",

      "disclaimer": "Measured to Cloudflare global edge. Corporate firewalls may throttle upload to non-whitelisted endpoints.",

      "drawer.history": "HISTORY",
      "drawer.historyTitle": "Test Runs",
      "drawer.about": "ABOUT",
      "drawer.aboutTitle": "Ultimate Speed Test",

      "grade.a": "Excellent",
      "grade.b": "Good",
      "grade.c": "Fair",
      "grade.d": "Poor",
      "grade.f": "Very Poor",
      "grade.pending": "PENDING",

      "share.text": "Ultimate Speed Test",
      "share.card.title": "ULTIMATE / SPEED TEST",
      "share.download": "Download",
      "share.upload": "Upload",
      "share.ping": "Ping",
    },

    es: {
      "idle.title": "¿Qué tan rápido viaja tu señal.",
      "idle.subtitle": "Pulsa para comenzar · Toma ~25s",
      "btn.start": "INICIAR",

      "phase.ping": "Ping",
      "phase.download": "Descarga",
      "phase.upload": "Carga",
      "phase.measuring": "MIDIENDO LATENCIA",

      "unit.ms": "ms",
      "unit.mbps": "Mbps",

      "metric.peak": "PICO",
      "metric.avg": "PROMEDIO",
      "metric.elapsed": "TIEMPO",
      "btn.cancel": "Cancelar",

      "result.complete": "PRUEBA COMPLETADA",
      "result.headline": "Tu conexión,<br /><em>forjada.</em>",
      "result.download": "DESCARGA",
      "result.upload": "CARGA",
      "result.ping": "PING",
      "result.jitter": "JITTER",
      "result.drag": "ARRASTRA · DESPLAZA",
      "result.capability": "// CAPACIDAD",
      "result.note": "// NOTA",
      "btn.runAgain": "Probar de Nuevo",
      "btn.share": "Compartir",

      "cap.hdCall": "Llamada HD",
      "cap.1080p": "1080p",
      "cap.4k": "4K HDR",
      "cap.gaming": "Juegos en la Nube",
      "cap.8k": "8K Multi",
      "cap.pro": "Pro · VR",

      "disclaimer": "Medido hacia el borde global de Cloudflare. Los cortafuegos corporativos pueden limitar la carga a puntos finales no autorizados.",

      "drawer.history": "HISTORIAL",
      "drawer.historyTitle": "Pruebas Anteriores",
      "drawer.about": "ACERCA DE",
      "drawer.aboutTitle": "Ultimate Speed Test",

      "grade.a": "Excelente",
      "grade.b": "Bueno",
      "grade.c": "Regular",
      "grade.d": "Pobre",
      "grade.f": "Muy Pobre",
      "grade.pending": "PENDIENTE",

      "share.text": "Ultimate Speed Test",
      "share.card.title": "ULTIMATE / SPEED TEST",
      "share.download": "Descarga",
      "share.upload": "Carga",
      "share.ping": "Ping",
    },

    ja: {
      "idle.title": "あなたの信号はどのくらい速く移動しますか。",
      "idle.subtitle": "始めるにはタップしてください · 約25秒",
      "btn.start": "スタート",

      "phase.ping": "Ping",
      "phase.download": "ダウンロード",
      "phase.upload": "アップロード",
      "phase.measuring": "遅延を測定中",

      "unit.ms": "ms",
      "unit.mbps": "Mbps",

      "metric.peak": "ピーク",
      "metric.avg": "平均",
      "metric.elapsed": "経過時間",
      "btn.cancel": "キャンセル",

      "result.complete": "ベンチマーク完了",
      "result.headline": "あなたの接続は<br /><em>鍛造</em>されました。",
      "result.download": "ダウンロード",
      "result.upload": "アップロード",
      "result.ping": "Ping",
      "result.jitter": "ジッター",
      "result.drag": "ドラッグ · スクロール",
      "result.capability": "// 性能",
      "result.note": "// 注記",
      "btn.runAgain": "もう一度実行",
      "btn.share": "共有",

      "cap.hdCall": "HDコール",
      "cap.1080p": "1080p",
      "cap.4k": "4K HDR",
      "cap.gaming": "クラウドゲーミング",
      "cap.8k": "8K マルチ",
      "cap.pro": "プロ · VR",

      "disclaimer": "Cloudflareグローバルエッジまで測定されています。企業のファイアウォールは、ホワイトリストに登録されていないエンドポイントへのアップロードを制限する可能性があります。",

      "drawer.history": "履歴",
      "drawer.historyTitle": "テスト実行",
      "drawer.about": "について",
      "drawer.aboutTitle": "Ultimate Speed Test",

      "grade.a": "優秀",
      "grade.b": "良好",
      "grade.c": "普通",
      "grade.d": "不良",
      "grade.f": "非常に悪い",
      "grade.pending": "保留中",

      "share.text": "Ultimate Speed Test",
      "share.card.title": "ULTIMATE / SPEED TEST",
      "share.download": "ダウンロード",
      "share.upload": "アップロード",
      "share.ping": "Ping",
    },
  };

  // Detect language from browser or localStorage
  let currentLang = localStorage.getItem("ust-lang") ||
    navigator.language.substring(0, 2);

  // Map browser lang codes to our supported langs
  const langMap = {
    "zh": "zh-TW",
    "en": "en",
    "es": "es",
    "ja": "ja",
  };

  if (!translations[currentLang]) {
    const mapped = langMap[currentLang];
    currentLang = mapped || "en"; // fallback to English
  }

  return {
    setLang(lang) {
      if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem("ust-lang", lang);
        return true;
      }
      return false;
    },

    getLang() {
      return currentLang;
    },

    get(key) {
      return translations[currentLang][key] ||
        translations.en[key] ||
        `[${key}]`;
    },

    getAll() {
      return Object.keys(translations);
    },
  };
})();
