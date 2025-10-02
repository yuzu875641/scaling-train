const fetch = require('node-fetch');

// プロキシのターゲットURL
const TARGET_BASE_URL = 'https://woke-proxy.poketube.fun/companion/latest_version';

module.exports = async (req, res) => {
  try {
    // クエリパラメータを取得 (例: id=...&itag=...)
    const queryString = req.url.split('?')[1] || '';

    // 転送先の完全なURLを構築
    const destinationUrl = `${TARGET_BASE_URL}?${queryString}`;
    
    // ターゲットURLへリクエストを送信
    const proxyRes = await fetch(destinationUrl, {
      method: req.method,
      headers: {
        // ユーザーエージェントを渡す
        'User-Agent': req.headers['user-agent'] || 'Vercel-Proxy-Function',
      },
    });

    // ターゲットからのレスポンスヘッダーをユーザーに返す
    proxyRes.headers.forEach((value, key) => {
      // ストリーミング時に問題を起こす可能性がある Content-Length はスキップ
      if (key.toLowerCase() !== 'content-length') {
        res.setHeader(key, value);
      }
    });

    // ステータスコードを設定
    res.statusCode = proxyRes.status;

    // レスポンスのデータをストリームとしてそのままユーザーに流す
    proxyRes.body.pipe(res);

  } catch (error) {
    console.error('Proxy error:', error);
    res.statusCode = 500;
    res.end('Proxy failed to connect.');
  }
};
