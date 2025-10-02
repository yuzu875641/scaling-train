const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // ユーザーからプロキシしたいURLを 'url' クエリパラメータから取得します
  const targetUrl = req.query.url;

  // 1. URLパラメータの基本的なバリデーション
  if (!targetUrl) {
    res.statusCode = 400;
    return res.end('Error: Missing "url" query parameter. Please provide the full URL to proxy.');
  }

  try {
    // 2. ターゲットURLのホスト名を取得
    const targetHost = new URL(targetUrl).host;
    
    console.log(`Dynamic Proxying request to: ${targetUrl}`);

    // 3. リクエストヘッダーの準備
    // 元のリクエストヘッダーをコピーしますが、Hostヘッダーをターゲットのホストに設定し直します
    // Content-Lengthはストリーミングのために除去します
    const proxyHeaders = {
      ...req.headers,
      Host: targetHost, // ターゲットサーバーが期待するHostヘッダーを設定
      'User-Agent': req.headers['user-agent'] || 'Vercel-Dynamic-Proxy',
    };
    delete proxyHeaders['content-length']; // Content-Lengthを削除
    delete proxyHeaders['transfer-encoding']; // Transfer-Encodingも削除

    // 4. ターゲットURLへリクエストを送信
    const proxyRes = await fetch(targetUrl, {
      method: req.method, // 元のリクエストメソッド (GET, POSTなど) を引き継ぐ
      headers: proxyHeaders, // 準備したヘッダーを使用
      // GETリクエスト以外の場合のボディ転送は、このコードでは省略しています
    });

    // 5. ターゲットからのレスポンスヘッダーをユーザーにすべて返す
    proxyRes.headers.forEach((value, key) => {
      // Content-Length ヘッダーと Transfer-Encoding ヘッダーは、ストリーミングやVercelの仕組みと干渉する可能性があるため、スキップします
      if (key.toLowerCase() !== 'content-length' && key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, value);
      }
    });

    // 6. ステータスコードを設定
    res.statusCode = proxyRes.status;

    // 7. レスポンスのデータをそのままユーザーにストリームとして流す
    proxyRes.body.pipe(res);

  } catch (error) {
    console.error('Dynamic Proxy failed:', error);
    res.statusCode = 500;
    res.end(`Proxy server error: Could not fetch URL. Error: ${error.message}`);
  }
};
