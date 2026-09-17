export type Lang = 'en' | 'zh'

const en = {
    title: 'FinGPT Workbench',
    ticker: 'Ticker',
    chart: 'Price',
    signals: 'FinRL Signals',
    asOf: 'as of',
    agent: 'Agent',
    action: 'Action',
    shares: 'Shares',
    position: 'Position',
    chat: 'FinGPT Agent',
    chatHint: 'Ask about news, fundamentals, or "what does FinGPT say?"',
    send: 'Send',
    thinking: 'Thinking…',
    calling: 'Calling',
    notDow: 'FinRL signals cover DOW 30 tickers only.',
    services: 'services',
    online: 'online',
    error: 'Error',
    disclaimer: 'Model output, not investment advice.',
}

export type Strings = { [K in keyof typeof en]: string }

const zh: Strings = {
    title: 'FinGPT 工作台',
    ticker: '代號',
    chart: '價格',
    signals: 'FinRL 訊號',
    asOf: '截至',
    agent: '模型',
    action: '動作',
    shares: '股數',
    position: '持倉',
    chat: 'FinGPT 助理',
    chatHint: '問新聞、基本面，或「FinGPT 怎麼說？」',
    send: '送出',
    thinking: '思考中…',
    calling: '呼叫',
    notDow: 'FinRL 訊號僅支援道瓊 30 成分股。',
    services: '個服務',
    online: '連線中',
    error: '錯誤',
    disclaimer: '模型輸出，非投資建議。',
}

export const t = (lang: Lang): Strings => (lang === 'en' ? en : zh)
